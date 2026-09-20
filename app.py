"""
app.py

The demo. Three panels:
  1. Scenario picker — pick a sample recording and a target scenario
     (clinical / seated / standing).
  2. Signal preview — before vs. after calibration, one channel.
  3. Results — domain-gap AUC before/after, windows tested, download
     the calibrated signal, and an explicit caveat about what's
     actually been calibrated (heartbeat only, standing = projected).

Run with: streamlit run app.py

Heavy computation (grid search, domain-gap tests) is cached so it
only runs once per session, not on every widget interaction.
"""

import os
import numpy as np
import pandas as pd
import streamlit as st

from load import load_tpehg, load_tpehgt, load_icelandic
from features import to_windows, windows_to_features
from domain_gap import domain_auc
from simulate import (
    load_clinical_records, load_seated_records, split_seated_records,
    grid_search, build_dataset, simulate_windows,
)
from standing_forecast import (
    simulate_window_variable_hr, STANDING_HR_INCREASE_BPM, BASELINE_SEATED_HR_BPM,
)

st.set_page_config(page_title="EHG Posture Calibration", layout="centered")


@st.cache_resource(show_spinner="Loading data and fitting the calibration (first run only)...")
def load_and_fit():
    clinical = load_clinical_records()
    seated = load_seated_records()
    if not clinical or not seated:
        return None
    tuning, held_out = split_seated_records(seated)

    X0, y0, g0 = build_dataset(clinical, tuning, knobs=None)
    raw_auc = domain_auc(X0, y0, g0)

    results = grid_search(clinical, tuning)
    best_knobs, tuning_auc = results[0]

    X1, y1, g1 = build_dataset(clinical, held_out, knobs=best_knobs)
    calibrated_auc = domain_auc(X1, y1, g1)

    return {
        "clinical": clinical,
        "held_out": held_out,
        "best_knobs": best_knobs,
        "raw_auc": raw_auc,
        "calibrated_auc": calibrated_auc,
        "n_windows_tested": len(y1),
    }


def get_sample_window(clinical_records, record_name):
    for windows, record_id, fs in clinical_records:
        if record_id == record_name and len(windows) > 0:
            return windows[0], fs
    return None, None


st.title("EHG posture calibration")
st.caption("Stress-test tool: see how a clinical EHG recording changes under a "
           "physiologically-grounded posture calibration.")

state = load_and_fit()

if state is None:
    st.error("No data found. Run `python download.py` first, then restart this app.")
    st.stop()

record_names = [r[1] for r in state["clinical"]]

col1, col2 = st.columns(2)
with col1:
    selected_record = st.selectbox("Sample recording", record_names)
with col2:
    scenario = st.radio("Scenario", ["Clinical", "Seated (calibrated)", "Standing (projected)"],
                         index=1, horizontal=False)

window, fs = get_sample_window(state["clinical"], selected_record)

if window is not None:
    heartbeat_k, breathing_k, muscle_k = state["best_knobs"]

    if scenario == "Clinical":
        after = window
        caption = "Raw clinical signal, no calibration applied."
    elif scenario == "Seated (calibrated)":
        after = simulate_windows(np.array([window]), fs, state["best_knobs"])[0]
        caption = f"Calibrated with fitted knobs: heartbeat={heartbeat_k}, breathing={breathing_k}, muscle={muscle_k}"
    else:
        mid_increase = (STANDING_HR_INCREASE_BPM[0] + STANDING_HR_INCREASE_BPM[1]) / 2
        standing_hr_hz = (BASELINE_SEATED_HR_BPM + mid_increase) / 60.0
        after = simulate_window_variable_hr(window, fs, standing_hr_hz, breathing_k, muscle_k, heartbeat_k)
        caption = (f"PROJECTED, not measured — heartbeat shifted to a midpoint standing estimate "
                   f"({BASELINE_SEATED_HR_BPM + mid_increase:.0f} bpm, placeholder range, needs sourcing)")

    st.subheader("Signal preview — channel 1")
    chart_df = pd.DataFrame({
        "before": window[0],
        "after": after[0],
    })
    st.line_chart(chart_df)
    st.caption(caption)

    st.subheader("Results")
    m1, m2, m3 = st.columns(3)
    m1.metric("Domain-gap AUC, raw", f"{state['raw_auc']:.2f}")
    m2.metric("Domain-gap AUC, calibrated", f"{state['calibrated_auc']:.2f}")
    m3.metric("Windows tested (held-out)", state["n_windows_tested"])

    csv_data = pd.DataFrame(after.T, columns=[f"channel_{i+1}" for i in range(after.shape[0])])
    st.download_button(
        "Download adapted signal (CSV)",
        csv_data.to_csv(index=False),
        file_name=f"{selected_record}_{scenario.split()[0].lower()}.csv",
        mime="text/csv",
    )

    st.caption(
        "Calibrated mechanism: heart rate, breathing, and muscle noise only. "
        "Seated is measured and validated on held-out women; standing is a "
        "sourced-range projection, not validated data. Electrode hardware "
        "differs between datasets, so some of the remaining gap is not posture."
    )
else:
    st.warning("Could not find a window for this record.")
