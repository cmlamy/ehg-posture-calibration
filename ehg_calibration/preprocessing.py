"""Signal harmonization and subject-balanced window selection."""

from __future__ import annotations

from fractions import Fraction

import numpy as np
from scipy.signal import butter, sosfiltfilt, resample_poly

from .config import ExperimentConfig
from .types import Record, RecordWindows


def preprocess_record(record: Record, config: ExperimentConfig) -> RecordWindows:
    """Band-pass, resample, trim and window one record."""
    low, high = config.bandpass_hz
    if high >= record.fs / 2:
        raise ValueError(
            f"Record {record.record_id}: bandpass high edge {high} exceeds native Nyquist"
        )
    sos = butter(4, (low, high), btype="bandpass", fs=record.fs, output="sos")
    filtered = sosfiltfilt(sos, record.signals, axis=-1)

    if not np.isclose(record.fs, config.target_fs):
        ratio = Fraction(config.target_fs / record.fs).limit_denominator(1000)
        filtered = resample_poly(filtered, ratio.numerator, ratio.denominator, axis=-1)

    trim = int(round(config.trim_seconds * config.target_fs))
    if trim:
        if filtered.shape[-1] <= 2 * trim:
            raise ValueError(
                f"Record {record.record_id} is too short for {config.trim_seconds}s edge trims"
            )
        filtered = filtered[:, trim:-trim]

    length = int(round(config.window_seconds * config.target_fs))
    count = filtered.shape[-1] // length
    if count < 1:
        raise ValueError(f"Record {record.record_id} has no complete windows after trimming")
    windows = filtered[:, : count * length].reshape(
        filtered.shape[0], count, length
    ).transpose(1, 0, 2)
    windows = reject_bad_windows(windows)
    if not len(windows):
        raise ValueError(f"Record {record.record_id} has no valid windows")
    return RecordWindows(
        record_id=record.record_id,
        subject_id=record.subject_id,
        windows=windows,
        fs=config.target_fs,
    )


def reject_bad_windows(windows: np.ndarray) -> np.ndarray:
    """Reject non-finite, flat, or extreme windows without assuming a fixed unit limit."""
    keep: list[bool] = []
    for window in windows:
        finite = np.isfinite(window).all()
        channel_std = np.std(window, axis=-1)
        live = bool(np.all(channel_std > 1e-10))
        # A robust within-record saturation check: enormous isolated values relative
        # to the channel median absolute deviation are likely corruption.
        centered = window - np.median(window, axis=-1, keepdims=True)
        mad = np.median(np.abs(centered), axis=-1) + 1e-12
        peak_ratio = np.max(np.abs(centered), axis=-1) / mad
        plausible = bool(np.all(peak_ratio < 1e5))
        keep.append(finite and live and plausible)
    return windows[np.asarray(keep, dtype=bool)]


def preprocess_records(
    records: list[Record], config: ExperimentConfig
) -> list[RecordWindows]:
    """Preprocess records, failing loudly instead of silently dropping data."""
    return [preprocess_record(record, config) for record in records]


def cap_windows_by_subject(
    records: list[RecordWindows], maximum: int, seed: int
) -> list[RecordWindows]:
    """Select at most `maximum` windows per subject across all their records."""
    by_subject: dict[str, list[tuple[int, int]]] = {}
    for record_index, record in enumerate(records):
        by_subject.setdefault(record.subject_id, []).extend(
            (record_index, window_index) for window_index in range(len(record.windows))
        )

    chosen: dict[int, list[int]] = {index: [] for index in range(len(records))}
    rng = np.random.default_rng(seed)
    for indices in by_subject.values():
        order = rng.permutation(len(indices))[:maximum]
        for chosen_index in order:
            record_index, window_index = indices[int(chosen_index)]
            chosen[record_index].append(window_index)

    capped: list[RecordWindows] = []
    for index, record in enumerate(records):
        selected = sorted(chosen[index])
        if selected:
            capped.append(
                RecordWindows(
                    record_id=record.record_id,
                    subject_id=record.subject_id,
                    windows=record.windows[selected],
                    fs=record.fs,
                )
            )
    return capped


def balance_subject_counts(
    first: list[Record],
    second: list[Record],
    maximum: int,
    seed: int,
) -> tuple[list[Record], list[Record]]:
    """Deterministically cap both domains to the same number of subjects."""
    first_ids = sorted({record.subject_id for record in first})
    second_ids = sorted({record.subject_id for record in second})
    count = min(len(first_ids), len(second_ids), maximum)
    if count < 3:
        raise ValueError("At least three subjects are required in each domain")
    rng = np.random.default_rng(seed)
    selected_first = set(rng.choice(first_ids, size=count, replace=False))
    selected_second = set(rng.choice(second_ids, size=count, replace=False))
    return (
        [record for record in first if record.subject_id in selected_first],
        [record for record in second if record.subject_id in selected_second],
    )
