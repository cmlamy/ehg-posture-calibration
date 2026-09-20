"""Training-only estimation of electrode-event morphology from target EHG."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from scipy.signal import butter, resample_poly, sosfiltfilt
from scipy.stats import spearmanr

from .config import ExperimentConfig
from .types import Record


@dataclass(frozen=True)
class DetectedEvent:
    time_seconds: float
    amplitude_ratio: float
    decay_seconds: float


def _processed_continuous(record: Record, config: ExperimentConfig) -> np.ndarray:
    low, high = config.bandpass_hz
    sos = butter(4, (low, high), btype="bandpass", fs=record.fs, output="sos")
    values = sosfiltfilt(sos, record.signals, axis=-1)
    if not np.isclose(record.fs, config.target_fs):
        from fractions import Fraction

        ratio = Fraction(config.target_fs / record.fs).limit_denominator(1000)
        values = resample_poly(values, ratio.numerator, ratio.denominator, axis=-1)
    trim = int(round(config.trim_seconds * config.target_fs))
    return values[:, trim:-trim] if trim else values


def detect_electrode_events(
    signal: np.ndarray,
    fs: float,
    detector: dict[str, float | list[float]],
) -> list[DetectedEvent]:
    """Detect abrupt jumps with a measurable return toward the local baseline."""
    values = np.asarray(signal, dtype=float)
    if values.ndim != 2 or values.shape[-1] < int(12 * fs):
        return []
    differences = np.diff(values, axis=-1)
    center = np.median(differences, axis=-1, keepdims=True)
    mad = np.median(np.abs(differences - center), axis=-1, keepdims=True) + 1e-12
    robust_z = np.max(np.abs(differences - center) / (1.4826 * mad), axis=0)
    threshold = float(detector["jump_robust_z_threshold"])
    candidates = np.flatnonzero(robust_z >= threshold) + 1
    refractory = max(1, int(round(float(detector["refractory_seconds"]) * fs)))
    baseline_samples = max(
        2, int(round(float(detector["pre_event_baseline_seconds"]) * fs))
    )
    decay_low, decay_high = (float(x) for x in detector["decay_time_range_seconds"])
    minimum_amplitude = float(detector["minimum_jump_amplitude_rms_ratio"])
    minimum_decay_rho = float(detector["minimum_decay_spearman_magnitude"])
    record_rms = np.sqrt(
        np.mean((values - np.mean(values, axis=-1, keepdims=True)) ** 2, axis=-1)
    )
    selected: list[int] = []
    for candidate in candidates:
        if candidate < baseline_samples or candidate + int(decay_high * fs) >= values.shape[-1]:
            continue
        if selected and candidate - selected[-1] < refractory:
            if robust_z[candidate - 1] > robust_z[selected[-1] - 1]:
                selected[-1] = int(candidate)
            continue
        selected.append(int(candidate))

    events: list[DetectedEvent] = []
    for sample in selected:
        baseline = np.median(values[:, sample - baseline_samples : sample], axis=-1)
        jump_by_channel = np.abs(values[:, sample] - baseline)
        channel = int(np.argmax(jump_by_channel))
        amplitude_ratio = float(
            jump_by_channel[channel] / max(record_rms[channel], 1e-12)
        )
        if amplitude_ratio < minimum_amplitude:
            continue
        trajectory = np.abs(
            values[channel, sample : sample + int(decay_high * fs) + 1]
            - baseline[channel]
        )
        target = jump_by_channel[channel] / np.e
        earliest = max(1, int(round(decay_low * fs)))
        returned = np.flatnonzero(trajectory[earliest:] <= target)
        if not len(returned):
            continue
        return_index = earliest + int(returned[0])
        decay_segment = trajectory[: return_index + 1]
        decay_rho = spearmanr(np.arange(len(decay_segment)), decay_segment).statistic
        if not np.isfinite(decay_rho) or decay_rho > -minimum_decay_rho:
            continue
        decay_seconds = float(return_index / fs)
        if np.isfinite(amplitude_ratio) and amplitude_ratio > 0:
            events.append(
                DetectedEvent(
                    time_seconds=float(sample / fs),
                    amplitude_ratio=amplitude_ratio,
                    decay_seconds=decay_seconds,
                )
            )
    return events


def _annotation_times(
    dataset_dir: Path,
    record: Record,
    config: ExperimentConfig,
) -> dict[str, np.ndarray]:
    annotation_path = dataset_dir / f"{record.record_id}.atr"
    if not annotation_path.exists():
        return {}
    import wfdb

    annotation = wfdb.rdann(str(annotation_path.with_suffix("")), "atr")
    shifted = annotation.sample.astype(float) / record.fs - config.trim_seconds
    result: dict[str, list[float]] = {}
    for time_seconds, symbol in zip(shifted, annotation.symbol, strict=True):
        if time_seconds >= 0:
            result.setdefault(symbol, []).append(float(time_seconds))
    return {key: np.asarray(value, dtype=float) for key, value in result.items()}


def _near_any(time_seconds: float, annotations: np.ndarray, radius: float) -> bool:
    return bool(len(annotations) and np.min(np.abs(annotations - time_seconds)) <= radius)


def estimate_event_statistics(
    records: list[Record],
    training_subject_ids: set[str],
    dataset_dir: str | Path,
    config: ExperimentConfig,
    standing_config: dict[str, Any],
) -> dict[str, Any]:
    """Estimate rates and morphology using target training subjects only."""
    detector = standing_config["event_detector"]
    association = float(detector["annotation_association_seconds"])
    all_events: list[DetectedEvent] = []
    movement_events: list[DetectedEvent] = []
    position_events: list[DetectedEvent] = []
    quiet_events: list[DetectedEvent] = []
    total_hours = 0.0
    movement_exposure_hours = 0.0
    annotated_records = 0
    movement_annotations = 0
    position_annotations = 0
    root = Path(dataset_dir)

    for record in records:
        if record.subject_id not in training_subject_ids:
            continue
        processed = _processed_continuous(record, config)
        duration = processed.shape[-1] / config.target_fs
        total_hours += duration / 3600.0
        events = detect_electrode_events(processed, config.target_fs, detector)
        annotations = _annotation_times(root, record, config)
        movement_times = np.concatenate(
            [annotations.get("pm", np.empty(0)), annotations.get("em", np.empty(0))]
        )
        position_times = annotations.get("pos", np.empty(0))
        if annotations:
            annotated_records += 1
        movement_annotations += len(movement_times)
        position_annotations += len(position_times)
        if len(movement_times):
            grid = np.zeros(processed.shape[-1], dtype=bool)
            radius = int(round(association * config.target_fs))
            for time_seconds in movement_times:
                center = int(round(time_seconds * config.target_fs))
                grid[max(0, center - radius) : min(len(grid), center + radius + 1)] = True
            movement_exposure_hours += float(np.sum(grid) / config.target_fs / 3600.0)
        for event in events:
            all_events.append(event)
            if _near_any(event.time_seconds, position_times, association):
                position_events.append(event)
            if _near_any(event.time_seconds, movement_times, association):
                movement_events.append(event)
            else:
                quiet_events.append(event)

    quiet_hours = max(total_hours - movement_exposure_hours, 1e-12)
    quiet_rate = len(quiet_events) / quiet_hours
    movement_rate = (
        len(movement_events) / movement_exposure_hours
        if movement_exposure_hours > 0
        else float("nan")
    )
    fallback = standing_config["fallback_assumptions"]
    rate_fallback = False
    morphology_fallback = False
    if not np.isfinite(quiet_rate) or not all_events:
        quiet_rate = float(fallback["quiet_event_rate_per_hour"])
        rate_fallback = True
    if not np.isfinite(movement_rate) or not movement_events:
        movement_rate = float(fallback["movement_event_rate_per_hour"])
        rate_fallback = True
    background_source = movement_events or all_events
    if background_source:
        amplitude_ratios = [event.amplitude_ratio for event in background_source]
        decay_seconds = [event.decay_seconds for event in background_source]
        background_source_label = (
            "movement_associated" if movement_events else "all_detected"
        )
    else:
        amplitude_ratios = list(fallback["jump_amplitude_ratio_range"])
        decay_seconds = list(fallback["decay_time_range_seconds"])
        background_source_label = "engineering_fallback"
        morphology_fallback = True
    transition_source = position_events or movement_events or all_events
    if transition_source:
        transition_amplitude_ratios = [
            event.amplitude_ratio for event in transition_source
        ]
        transition_decay_seconds = [event.decay_seconds for event in transition_source]
        transition_source_label = (
            "position_change_associated"
            if position_events
            else "movement_associated" if movement_events else "all_detected"
        )
    else:
        transition_amplitude_ratios = list(fallback["jump_amplitude_ratio_range"])
        transition_decay_seconds = list(fallback["decay_time_range_seconds"])
        transition_source_label = "engineering_fallback"

    return {
        "status": "target_training_subset_observation",
        "training_subject_count": len(training_subject_ids),
        "training_record_count": sum(
            record.subject_id in training_subject_ids for record in records
        ),
        "annotated_record_count": annotated_records,
        "detected_event_count": len(all_events),
        "movement_associated_detected_event_count": len(movement_events),
        "position_change_associated_detected_event_count": len(position_events),
        "movement_annotation_count": movement_annotations,
        "position_annotation_count": position_annotations,
        "quiet_event_rate_per_hour": float(quiet_rate),
        "movement_associated_event_rate_per_hour": float(movement_rate),
        "movement_to_quiet_rate_ratio": (
            float(movement_rate / quiet_rate) if quiet_rate > 0 else None
        ),
        "amplitude_ratio_samples": [float(value) for value in amplitude_ratios],
        "decay_seconds_samples": [float(value) for value in decay_seconds],
        "background_morphology_source": background_source_label,
        "transition_amplitude_ratio_samples": [
            float(value) for value in transition_amplitude_ratios
        ],
        "transition_decay_seconds_samples": [
            float(value) for value in transition_decay_seconds
        ],
        "transition_morphology_source": transition_source_label,
        "rate_fallback_used": rate_fallback,
        "morphology_fallback_used": morphology_fallback,
        "detector_configuration": detector,
        "interpretation": (
            "Observed in target training recordings and used only to bound a standing "
            "sensitivity hypothesis; these are not standing measurements."
        ),
    }
