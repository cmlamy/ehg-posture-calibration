"""
load.py

Turns raw WFDB records from the three datasets into a consistent format:
a small number of bipolar EHG channels, band-pass filtered (0.2-3 Hz),
sampled at 20 Hz, with the filter-distorted edges trimmed off.

This follows Links 4, 5, 6, and 7 of the calibration doc, and mirrors the
preprocessing in Happillon et al. 2018 (IRBM 39:379-385).

IMPORTANT — verify before trusting this on your machine:
    Datasets differ in how their channels are actually named in the WFDB
    files. Run `inspect_record()` on one record from each dataset FIRST
    and check the printed channel names / units / sampling rate match
    what's assumed below. This is Step 2-4 in the calibration doc's
    Part B, and it's the #1 place things silently break.

Each loader returns a dict:
    {
        "record_id": str,
        "fs": int,              # always 20 after processing
        "channels": np.ndarray, # shape (n_channels, n_samples), in mV
        "channel_names": list,
    }
"""

import os
import numpy as np
import wfdb
from scipy.signal import butter, filtfilt, resample_poly

BANDPASS_LOW_HZ = 0.2
BANDPASS_HIGH_HZ = 3.0
TARGET_FS = 20
TRIM_SECONDS = 180  # PhysioNet's own advice for TPEHG; we apply it everywhere for consistency

# Icelandic 4x4 grid, numbered as in Happillon Fig. 2 / the calibration doc.
# VERIFY this against the database paper [5] before trusting it (Step 4).
VERTICAL_PAIRS = [
    (1, 2), (2, 3), (3, 4),
    (5, 6), (6, 7), (7, 8),
    (9, 10), (10, 11), (11, 12),
    (13, 14), (14, 15), (15, 16),
]
# We keep 3 of these 12 to match TPEHG's channel count (our choice, per the doc).
ICELANDIC_KEEP_PAIRS = [(2, 3), (6, 7), (10, 11)]


def inspect_record(record_path):
    """Print everything you need to sanity-check a record before trusting it."""
    rec = wfdb.rdrecord(record_path)
    print(f"Record: {record_path}")
    print(f"  Channel names : {rec.sig_name}")
    print(f"  Sampling rate : {rec.fs} Hz")
    print(f"  Units         : {rec.units}")
    print(f"  Duration      : {rec.p_signal.shape[0] / rec.fs / 60:.1f} min")
    print(f"  Shape         : {rec.p_signal.shape}")
    if rec.comments:
        print(f"  Comments      : {rec.comments}")
    return rec


def bandpass(signal, fs, low=BANDPASS_LOW_HZ, high=BANDPASS_HIGH_HZ, order=4):
    """Zero-phase Butterworth band-pass, per Link 7 of the calibration doc."""
    nyq = fs / 2
    b, a = butter(order, [low / nyq, high / nyq], btype="band")
    return filtfilt(b, a, signal)


def trim_edges(signal, fs, seconds=TRIM_SECONDS):
    """Drop the filter-distorted start/end of a recording."""
    n = int(seconds * fs)
    if signal.shape[-1] <= 2 * n:
        return signal  # recording too short to trim safely; caller should flag this
    return signal[..., n:-n]


def _process_channels(raw_channels, fs, target_fs=TARGET_FS):
    """Filter at native fs, then resample to target_fs, then trim edges."""
    filtered = np.array([bandpass(ch, fs) for ch in raw_channels])
    if fs != target_fs:
        # resample_poly wants integer up/down factors; this assumes fs and
        # target_fs share a clean ratio (true for 200->20). Verify for others.
        down = int(fs / target_fs)
        filtered = resample_poly(filtered, up=1, down=down, axis=-1)
    return trim_edges(filtered, target_fs)


def load_tpehg(record_path):
    """
    Load one TPEHG record. TPEHG is already at 20 Hz.
    CHECK rec.sig_name against what you expect — adjust the selection
    below if the real channel names differ (Step 2 in the doc).
    """
    rec = wfdb.rdrecord(record_path)
    assert rec.fs == 20, f"Expected 20 Hz, got {rec.fs} — check this record"

    # Adjust this selection once you've run inspect_record() and confirmed names.
    raw = rec.p_signal.T  # shape (n_channels, n_samples)
    channels = _process_channels(raw, fs=rec.fs)
    return {
        "record_id": os.path.basename(record_path),
        "fs": TARGET_FS,
        "channels": channels,
        "channel_names": rec.sig_name,
    }


def load_tpehgt(record_path):
    """Load one TPEHGT record. Same structure as TPEHG, plus a tocogram channel
    you may want to exclude from EHG-only analysis — check rec.sig_name."""
    return load_tpehg(record_path)  # same format/sampling; loader logic is identical


def load_icelandic(record_path):
    """
    Load one Icelandic record. Recorded at 200 Hz on a 4x4 electrode grid;
    build bipolar vertical-pair channels first, THEN filter and downsample
    to match TPEHG's 20 Hz (Links 4, 5, 7).
    """
    rec = wfdb.rdrecord(record_path)
    assert rec.fs == 200, f"Expected 200 Hz, got {rec.fs} — check this record"

    sig = rec.p_signal.T  # shape (16, n_samples), monopolar
    # electrode N is channel index N-1
    bipolar = np.array([sig[a - 1] - sig[b - 1] for a, b in ICELANDIC_KEEP_PAIRS])

    channels = _process_channels(bipolar, fs=rec.fs)
    return {
        "record_id": os.path.basename(record_path),
        "fs": TARGET_FS,
        "channels": channels,
        "channel_names": [f"V{a}{b}" for a, b in ICELANDIC_KEEP_PAIRS],
    }


if __name__ == "__main__":
    # Quick smoke test — point these at one real downloaded record each.
    import glob

    for label, loader, folder in [
        ("TPEHG", load_tpehg, "data/tpehg"),
        ("TPEHGT", load_tpehgt, "data/tpehgt"),
        ("Icelandic", load_icelandic, "data/icelandic"),
    ]:
        hea_files = glob.glob(os.path.join(folder, "*.hea"))
        if not hea_files:
            print(f"[{label}] no records found in {folder} — run download.py first")
            continue
        record_path = hea_files[0][:-4]  # strip .hea
        print(f"\n[{label}] inspecting {record_path}")
        inspect_record(record_path)
        result = loader(record_path)
        print(f"[{label}] loaded shape: {result['channels'].shape}, fs={result['fs']}")
