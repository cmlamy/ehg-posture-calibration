"""
simulate.py

Adds three simulated posture-related effects to clinical (lying-down)
windows, each scaled relative to the window's own loudness:
    - heartbeat: a sine wave near 1.4 Hz
    - breathing: a slow sine wave near 0.27 Hz
    - muscle noise: broadband random noise

A grid search over knob strengths finds the combination that most
confuses the domain-gap classifier (lowest AUC) on HALF of the seated
women. The other half is held out for the real "after" test in the
next step.

This intentionally does NOT use MMD or an optimizer — a small grid
search is slower to explore but far less likely to silently fail,
which matters more than elegance on a fixed clock.
"""

import os
import numpy as np

from load import load_tpehg, load_tpehgt, load_icelandic
from features import to_windows, windows_to_features
from domain_gap import domain_auc

HEARTBEAT_HZ = 1.4
BREATHING_HZ = 0.27
KNOB_VALUES = (0.0, 0.25, 0.5, 1.0)
TUNING_SEED = 42  # fixed so the tuning/held-out split is reproducible


def simulate_window(window, fs, heartbeat=0.0, breathing=0.0, muscle=0.0):
    """
    window: shape (n_channels, window_samples). Each knob is a strength
    in [0, 1], scaled relative to that channel's own RMS so it behaves
    consistently across quiet and loud windows.
    """
    n_channels, n_samples = window.shape
    t = np.arange(n_samples) / fs
    out = window.copy()

    for i in range(n_channels):
        rms = np.sqrt(np.mean(window[i] ** 2)) + 1e-10
        if heartbeat > 0:
            out[i] += heartbeat * rms * np.sin(2 * np.pi * HEARTBEAT_HZ * t)
        if breathing > 0:
            out[i] += breathing * rms * np.sin(2 * np.pi * BREATHING_HZ * t)
        if muscle > 0:
            out[i] += muscle * rms * np.random.default_rng(0).normal(size=n_samples)
    return out


def simulate_windows(windows, fs, knobs):
    if windows.shape[0] == 0 or all(v == 0 for v in knobs):
        return windows
    heartbeat, breathing, muscle = knobs
    return np.array([simulate_window(w, fs, heartbeat, breathing, muscle) for w in windows])


def _raw_windows_by_record(folder, loader):
    """Returns list of (windows, record_id) — features not extracted yet,
    so the caller can perturb the raw signal first."""
    if not os.path.isdir(folder):
        print(f"[skip] {folder} not found — run download.py first")
        return []
    results = []
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".hea"):
            continue
        record_path = os.path.join(folder, f[:-4])
        try:
            rec = loader(record_path)
        except Exception as e:
            print(f"  [skip] {f}: {e}")
            continue
        windows = to_windows(rec["channels"], rec["fs"])
        if len(windows) > 0:
            results.append((windows, rec["record_id"], rec["fs"]))
    return results


def load_clinical_records():
    return _raw_windows_by_record("data/tpehg", load_tpehg) + \
           _raw_windows_by_record("data/tpehgt", load_tpehgt)


def load_seated_records():
    return _raw_windows_by_record("data/icelandic", load_icelandic)


def split_seated_records(seated_records, seed=TUNING_SEED):
    """Split seated records (by record/woman) into a tuning half and a
    held-out half. Held-out is never touched until the final test."""
    ids = [r[1] for r in seated_records]
    rng = np.random.default_rng(seed)
    shuffled = rng.permutation(len(ids))
    half = len(ids) // 2
    tuning_idx = set(shuffled[:half])
    tuning = [r for i, r in enumerate(seated_records) if i in tuning_idx]
    held_out = [r for i, r in enumerate(seated_records) if i not in tuning_idx]
    return tuning, held_out


def build_dataset(clinical_records, seated_records, knobs=None):
    """
    clinical_records / seated_records: list of (windows, record_id, fs).
    If knobs is given, clinical windows are simulated before feature
    extraction; seated windows are always real, untouched.
    """
    X, y, groups = [], [], []

    for windows, record_id, fs in clinical_records:
        w = simulate_windows(windows, fs, knobs) if knobs else windows
        feats = windows_to_features(w, fs)
        X.append(feats)
        y.append(np.zeros(len(feats)))
        groups.append([record_id] * len(feats))

    for windows, record_id, fs in seated_records:
        feats = windows_to_features(windows, fs)
        X.append(feats)
        y.append(np.ones(len(feats)))
        groups.append([record_id] * len(feats))

    return np.vstack(X), np.concatenate(y), np.concatenate(groups)


def grid_search(clinical_records, tuning_seated_records, knob_values=KNOB_VALUES):
    """Tries every (heartbeat, breathing, muscle) combination, returns
    the one with the lowest domain-gap AUC on the tuning half."""
    results = []
    for hb in knob_values:
        for br in knob_values:
            for mu in knob_values:
                knobs = (hb, br, mu)
                X, y, groups = build_dataset(clinical_records, tuning_seated_records, knobs)
                try:
                    auc = domain_auc(X, y, groups)
                except ValueError as e:
                    print(f"  [skip] knobs={knobs}: {e}")
                    continue
                results.append((knobs, auc))
                print(f"  heartbeat={hb:.2f} breathing={br:.2f} muscle={mu:.2f} -> AUC={auc:.3f}")

    results.sort(key=lambda r: r[1])
    return results


if __name__ == "__main__":
    print("Loading raw windows...")
    clinical = load_clinical_records()
    seated = load_seated_records()
    print(f"  {len(clinical)} clinical records, {len(seated)} seated records")

    tuning, held_out = split_seated_records(seated)
    print(f"  seated split: {len(tuning)} tuning / {len(held_out)} held out")

    print("\nBaseline (no calibration) on tuning half:")
    X0, y0, g0 = build_dataset(clinical, tuning, knobs=None)
    baseline_auc = domain_auc(X0, y0, g0)
    print(f"  AUC = {baseline_auc:.3f}")

    print("\nGrid search over 3 knobs (4 values each = 64 combinations)...")
    results = grid_search(clinical, tuning)
    best_knobs, best_auc = results[0]
    print(f"\nBest knobs: heartbeat={best_knobs[0]}, breathing={best_knobs[1]}, "
          f"muscle={best_knobs[2]} -> tuning AUC={best_auc:.3f}")

    print("\nFinal test on HELD-OUT seated women (never used for tuning):")
    X1, y1, g1 = build_dataset(clinical, held_out, knobs=best_knobs)
    final_auc = domain_auc(X1, y1, g1)
    print(f"  Raw AUC (baseline):      {baseline_auc:.3f}")
    print(f"  Calibrated AUC (held-out): {final_auc:.3f}")
