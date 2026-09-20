"""
features.py

Cuts cleaned EHG channels into 60-second windows and describes each
window with a small feature vector: overall loudness (RMS) plus the
fraction of spectral power in a few bands, via Welch's method.

This is the "hours 3-7" piece: windowing + features feed straight into
domain_gap.py's classifier.
"""

import numpy as np
from scipy.signal import welch

WINDOW_SECONDS = 60
BANDS = [(0.2, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 3.0)]


def to_windows(channels, fs, window_seconds=WINDOW_SECONDS):
    """
    Cut (n_channels, n_samples) into non-overlapping windows.
    Returns an array of shape (n_windows, n_channels, window_samples).
    Drops a trailing partial window and any window that's flat (dead
    electrode) or wildly saturated.
    """
    window_len = int(window_seconds * fs)
    n_channels, n_samples = channels.shape
    n_windows = n_samples // window_len
    if n_windows == 0:
        return np.empty((0, n_channels, window_len))

    trimmed = channels[:, : n_windows * window_len]
    windows = trimmed.reshape(n_channels, n_windows, window_len).transpose(1, 0, 2)

    keep = []
    for w in windows:
        flat = np.allclose(w.std(axis=-1), 0, atol=1e-6)
        huge = np.max(np.abs(w)) > 5.0  # mV; adjust if your data's scale differs
        keep.append(not flat and not huge)
    return windows[np.array(keep)]


def _band_power_fractions(freqs, psd, bands=BANDS):
    total = np.trapz(psd, freqs)
    if total <= 0:
        return [0.0] * len(bands)
    fractions = []
    for lo, hi in bands:
        mask = (freqs >= lo) & (freqs <= hi)
        band_power = np.trapz(psd[mask], freqs[mask]) if mask.any() else 0.0
        fractions.append(band_power / total)
    return fractions


def extract_features(window, fs):
    """
    window: shape (n_channels, window_samples).
    Returns one feature vector, averaged across channels:
        [log RMS, power 0.2-0.5, 0.5-1.0, 1.0-1.5, 1.5-3.0, spectral centroid, spectral entropy]
    Averaging across channels keeps things simple for the hackathon;
    per-channel features are a natural next step if time allows.
    """
    per_channel_feats = []
    for ch in window:
        rms = np.sqrt(np.mean(ch ** 2))
        log_rms = np.log(rms + 1e-10)

        freqs, psd = welch(ch, fs=fs, nperseg=min(256, len(ch)))
        band_fracs = _band_power_fractions(freqs, psd)

        total_power = np.trapz(psd, freqs)
        centroid = np.trapz(freqs * psd, freqs) / total_power if total_power > 0 else 0.0

        psd_norm = psd / (psd.sum() + 1e-12)
        entropy = -np.sum(psd_norm * np.log(psd_norm + 1e-12))
        entropy /= np.log(len(psd_norm))  # normalize to [0, 1]

        per_channel_feats.append([log_rms, *band_fracs, centroid, entropy])

    return np.mean(per_channel_feats, axis=0)


def windows_to_features(windows, fs):
    """windows: (n_windows, n_channels, window_samples) -> (n_windows, n_features)"""
    if len(windows) == 0:
        return np.empty((0, 3 + len(BANDS)))
    return np.array([extract_features(w, fs) for w in windows])


FEATURE_NAMES = ["log_rms", "power_0.2-0.5", "power_0.5-1.0", "power_1.0-1.5",
                  "power_1.5-3.0", "spectral_centroid", "spectral_entropy"]
