"""Compact amplitude and spectral features used by MMD."""

from __future__ import annotations

import numpy as np
from scipy.integrate import trapezoid
from scipy.signal import welch

FEATURE_NAMES = (
    "log_rms",
    "power_0.2_0.5",
    "power_0.5_1.0",
    "power_1.0_1.5",
    "power_1.5_3.0",
    "spectral_centroid",
    "spectral_entropy",
    "line_length",
    "zero_crossing_rate",
)
BANDS = ((0.2, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 3.0))


def extract_window_features(window: np.ndarray, fs: float) -> np.ndarray:
    """Return channel-averaged EHG features for one window."""
    rows: list[list[float]] = []
    for channel in np.asarray(window, dtype=float):
        centered = channel - np.mean(channel)
        rms = float(np.sqrt(np.mean(centered**2)))
        frequencies, psd = welch(centered, fs=fs, nperseg=min(256, len(centered)))
        relevant = (frequencies >= 0.2) & (frequencies <= 3.0)
        frequencies = frequencies[relevant]
        psd = psd[relevant]
        total = float(trapezoid(psd, frequencies)) if len(frequencies) > 1 else 0.0
        fractions: list[float] = []
        for low, high in BANDS:
            mask = (frequencies >= low) & (frequencies < high)
            power = float(trapezoid(psd[mask], frequencies[mask])) if mask.sum() > 1 else 0.0
            fractions.append(power / (total + 1e-15))
        centroid = (
            float(trapezoid(frequencies * psd, frequencies)) / total if total > 0 else 0.0
        )
        probabilities = psd / (np.sum(psd) + 1e-15)
        entropy = -float(np.sum(probabilities * np.log(probabilities + 1e-15)))
        if len(probabilities) > 1:
            entropy /= float(np.log(len(probabilities)))
        line_length = float(np.mean(np.abs(np.diff(centered))) / (rms + 1e-15))
        signs = np.signbit(centered)
        zero_crossing = float(np.mean(signs[1:] != signs[:-1]))
        rows.append(
            [
                np.log(rms + 1e-15),
                *fractions,
                centroid,
                entropy,
                line_length,
                zero_crossing,
            ]
        )
    return np.mean(np.asarray(rows), axis=0)


def extract_features(windows: np.ndarray, fs: float) -> np.ndarray:
    """Convert `(windows, channels, samples)` into a feature matrix.

    This vectorized path is used inside every optimizer evaluation and is much
    faster than calling Welch separately for each window and channel.
    """
    values = np.asarray(windows, dtype=float)
    if len(values) == 0:
        return np.empty((0, len(FEATURE_NAMES)), dtype=float)
    if values.ndim != 3:
        raise ValueError("windows must have shape (windows, channels, samples)")

    centered = values - np.mean(values, axis=-1, keepdims=True)
    rms = np.sqrt(np.mean(centered**2, axis=-1))
    frequencies, psd = welch(
        centered, fs=fs, nperseg=min(256, values.shape[-1]), axis=-1
    )
    relevant = (frequencies >= 0.2) & (frequencies <= 3.0)
    frequencies = frequencies[relevant]
    psd = psd[..., relevant]
    total = trapezoid(psd, frequencies, axis=-1)

    columns: list[np.ndarray] = [np.log(rms + 1e-15)]
    for low, high in BANDS:
        mask = (frequencies >= low) & (frequencies < high)
        if mask.sum() > 1:
            power = trapezoid(psd[..., mask], frequencies[mask], axis=-1)
        else:
            power = np.zeros_like(total)
        columns.append(power / (total + 1e-15))

    centroid = trapezoid(psd * frequencies, frequencies, axis=-1) / (total + 1e-15)
    probabilities = psd / (np.sum(psd, axis=-1, keepdims=True) + 1e-15)
    entropy = -np.sum(probabilities * np.log(probabilities + 1e-15), axis=-1)
    if len(frequencies) > 1:
        entropy /= np.log(len(frequencies))
    line_length = np.mean(np.abs(np.diff(centered, axis=-1)), axis=-1) / (rms + 1e-15)
    signs = np.signbit(centered)
    zero_crossing = np.mean(signs[..., 1:] != signs[..., :-1], axis=-1)
    columns.extend((centroid, entropy, line_length, zero_crossing))
    per_channel = np.stack(columns, axis=-1)
    return np.mean(per_channel, axis=1)
