"""Unvalidated standing projection and sensitivity analysis."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from scipy.signal import butter, sosfreqz, sosfiltfilt
from scipy.stats import spearmanr

from .config import ExperimentConfig
from .features import extract_window_features
from .simulator import (
    SimulatedWindowTrace,
    SimulationParameters,
    simulate_window_with_trace,
    simulation_seed,
)
from .types import RecordWindows

SCENARIOS = ("standing_still", "sit_to_stand_transition", "walking")
METRIC_NAMES = (
    "envelope_correlation_with_target_calibrated",
    "envelope_correlation_with_original",
    "interchannel_correlation_mean_absolute_change",
    "rms_ratio_to_target_calibrated",
    "spectral_centroid_shift_hz",
    "spectral_entropy_change",
    "realized_standing_artifact_rms_ratio",
)
SENSITIVITY_INPUTS = (
    "heart_rate_multiplier",
    "standing_hr_bpm",
    "electrode_event_rate_per_hour",
    "event_count",
    "mean_jump_amplitude_ratio",
    "mean_decay_seconds",
    "walking_cadence_steps_per_minute",
)


@dataclass(frozen=True)
class WindowProjection:
    final_signal: np.ndarray
    cardiac_component: np.ndarray
    electrode_component: np.ndarray
    sampled: dict[str, Any]


@dataclass(frozen=True)
class StandingProjectionResult:
    summary: dict[str, Any]
    samples: list[dict[str, Any]]
    demo: dict[str, np.ndarray]


def load_standing_config(path: str | Path) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        config = json.load(handle)
    if int(config.get("schema_version", 0)) != 1:
        raise ValueError("Unsupported standing projection configuration schema")
    low, high = (float(x) for x in config["heart_rate_multiplier_range"])
    if low <= 0 or high < low:
        raise ValueError("heart_rate_multiplier_range must satisfy 0 < low <= high")
    if int(config["default_draws"]) < 1:
        raise ValueError("default_draws must be positive")
    return config


def contraction_envelope(window: np.ndarray, fs: float, cutoff_hz: float) -> np.ndarray:
    """Return a slow, channel-averaged rectified EHG envelope."""
    values = np.asarray(window, dtype=float)
    centered = values - np.mean(values, axis=-1, keepdims=True)
    rectified = np.abs(centered)
    if cutoff_hz <= 0 or cutoff_hz >= fs / 2:
        raise ValueError("Envelope cutoff must lie between zero and Nyquist")
    sos = butter(2, cutoff_hz, btype="lowpass", fs=fs, output="sos")
    envelope = sosfiltfilt(sos, rectified, axis=-1)
    return np.mean(envelope, axis=0)


def _safe_correlation(first: np.ndarray, second: np.ndarray) -> float:
    if np.std(first) <= 1e-12 or np.std(second) <= 1e-12:
        return 0.0
    return float(np.corrcoef(first, second)[0, 1])


def _bandpass_magnitude(config: ExperimentConfig, frequency_hz: float) -> float:
    if frequency_hz <= 0 or frequency_hz >= config.target_fs / 2:
        return 0.0
    sos = butter(
        4,
        config.bandpass_hz,
        btype="bandpass",
        fs=config.target_fs,
        output="sos",
    )
    _, response = sosfreqz(sos, worN=np.asarray([frequency_hz]), fs=config.target_fs)
    return float(np.abs(response[0]))


def _project_cardiac_component(
    trace: SimulatedWindowTrace,
    samples: int,
    fs: float,
    multiplier: float,
    config: ExperimentConfig,
) -> np.ndarray:
    """Move only cardiac frequency while retaining fitted component RMS."""
    if np.isclose(multiplier, 1.0) or not np.any(trace.cardiac_channel_amplitude):
        return trace.transformed_cardiac_component.copy()
    time = np.arange(samples, dtype=float) / fs
    reference = trace.cardiac_reference_hz
    projected = reference * multiplier
    wave = np.sin(2 * np.pi * projected * time + trace.cardiac_phase)
    if 2 * projected < fs / 2:
        original_gain = _bandpass_magnitude(config, 2 * reference)
        projected_gain = _bandpass_magnitude(config, 2 * projected)
        relative_gain = projected_gain / max(original_gain, 1e-12)
        wave += 0.35 * relative_gain * np.sin(
            4 * np.pi * projected * time + 2 * trace.cardiac_phase
        )
    wave /= np.sqrt(np.mean(wave**2)) + 1e-12
    component = trace.cardiac_channel_amplitude[:, None] * wave[None, :]
    return trace.transform_component(component)


def _empirical_draw(values: list[float], rng: np.random.Generator) -> float:
    finite = np.asarray([value for value in values if np.isfinite(value) and value > 0])
    if not len(finite):
        raise ValueError("Standing event morphology contains no positive finite values")
    if len(finite) >= 5:
        low, high = np.quantile(finite, (0.05, 0.95))
        finite = np.clip(finite, low, high)
    return float(rng.choice(finite))


def _event_times(
    scenario: str,
    duration_seconds: float,
    fs: float,
    rate_per_hour: float,
    rng: np.random.Generator,
    standing_config: dict[str, Any],
) -> tuple[list[float], float | None, float | None]:
    transition_time = None
    cadence = None
    if scenario == "walking":
        cadence = float(
            rng.uniform(*standing_config["walking"]["cadence_steps_per_minute_range"])
        )
        step_period = 60.0 / cadence
        phase = rng.uniform(0, step_period)
        opportunities = np.arange(phase, duration_seconds, step_period)
        probability = min(1.0, rate_per_hour / max(cadence * 60.0, 1e-12))
        times = opportunities[rng.random(len(opportunities)) < probability].tolist()
    else:
        count = int(rng.poisson(rate_per_hour * duration_seconds / 3600.0))
        times = rng.uniform(0, duration_seconds, size=count).tolist()
    if scenario == "sit_to_stand_transition":
        transition_config = standing_config["sit_to_stand_transition"]
        center = float(transition_config["transition_time_seconds"])
        jitter = float(transition_config["transition_time_jitter_seconds"])
        latest_sample_time = max(0.0, duration_seconds - 1.0 / fs)
        transition_time = float(
            np.clip(rng.normal(center, jitter), 0.0, latest_sample_time)
        )
        times.append(transition_time)
    return sorted(float(value) for value in times), cadence, transition_time


def project_window(
    trace: SimulatedWindowTrace,
    fs: float,
    scenario: str,
    heart_rate_multiplier: float,
    event_rate_per_hour: float,
    amplitude_ratio_samples: list[float],
    decay_seconds_samples: list[float],
    transition_amplitude_ratio_samples: list[float] | None,
    transition_decay_seconds_samples: list[float] | None,
    rng: np.random.Generator,
    calibration_config: ExperimentConfig,
    standing_config: dict[str, Any],
) -> WindowProjection:
    """Apply one sampled standing perturbation to a fixed calibrated window."""
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown standing scenario {scenario!r}")
    seated = trace.final_signal
    projected_heart = _project_cardiac_component(
        trace,
        seated.shape[-1],
        fs,
        heart_rate_multiplier,
        calibration_config,
    )
    cardiac_delta = projected_heart - trace.transformed_cardiac_component
    duration_seconds = seated.shape[-1] / fs
    event_times, cadence, transition_time = _event_times(
        scenario, duration_seconds, fs, event_rate_per_hour, rng, standing_config
    )
    source_rms = np.sqrt(
        np.mean((seated - np.mean(seated, axis=-1, keepdims=True)) ** 2, axis=-1)
    )
    electrode_component = np.zeros_like(seated)
    amplitude_draws: list[float] = []
    decay_draws: list[float] = []
    time = np.arange(seated.shape[-1], dtype=float) / fs
    for event_time in event_times:
        is_transition = transition_time is not None and np.isclose(
            event_time, transition_time
        )
        event_amplitudes = (
            transition_amplitude_ratio_samples
            if is_transition and transition_amplitude_ratio_samples
            else amplitude_ratio_samples
        )
        event_decays = (
            transition_decay_seconds_samples
            if is_transition and transition_decay_seconds_samples
            else decay_seconds_samples
        )
        amplitude_ratio = _empirical_draw(event_amplitudes, rng)
        decay_seconds = _empirical_draw(event_decays, rng)
        spatial = rng.normal(size=seated.shape[0])
        spatial /= np.max(np.abs(spatial)) + 1e-12
        after = time >= event_time
        shape = np.zeros_like(time)
        shape[after] = np.exp(-(time[after] - event_time) / decay_seconds)
        electrode_component += (
            amplitude_ratio * source_rms[:, None] * spatial[:, None] * shape[None, :]
        )
        amplitude_draws.append(amplitude_ratio)
        decay_draws.append(decay_seconds)
    final = seated + cardiac_delta + electrode_component
    sampled = {
        "heart_rate_multiplier": float(heart_rate_multiplier),
        "reference_hr_bpm": float(trace.cardiac_reference_hz * 60.0),
        "standing_hr_bpm": float(trace.cardiac_reference_hz * 60.0 * heart_rate_multiplier),
        "electrode_event_rate_per_hour": float(event_rate_per_hour),
        "event_count": len(event_times),
        "event_times_seconds": event_times,
        "jump_amplitude_ratios": amplitude_draws,
        "decay_times_seconds": decay_draws,
        "mean_jump_amplitude_ratio": (
            float(np.mean(amplitude_draws)) if amplitude_draws else 0.0
        ),
        "mean_decay_seconds": float(np.mean(decay_draws)) if decay_draws else 0.0,
        "transition_event": transition_time is not None,
        "walking": scenario == "walking",
        "walking_cadence_steps_per_minute": cadence,
    }
    return WindowProjection(
        final_signal=final,
        cardiac_component=cardiac_delta,
        electrode_component=electrode_component,
        sampled=sampled,
    )


def _window_metrics(
    original: np.ndarray,
    seated: np.ndarray,
    projected: np.ndarray,
    fs: float,
    envelope_cutoff: float,
) -> dict[str, float]:
    original_envelope = contraction_envelope(original, fs, envelope_cutoff)
    seated_envelope = contraction_envelope(seated, fs, envelope_cutoff)
    projected_envelope = contraction_envelope(projected, fs, envelope_cutoff)
    seated_corr = np.corrcoef(seated)
    projected_corr = np.corrcoef(projected)
    triangle = np.triu_indices(seated.shape[0], k=1)
    seated_rms = np.sqrt(np.mean(seated**2))
    features_seated = extract_window_features(seated, fs)
    features_projected = extract_window_features(projected, fs)
    artifact = projected - seated
    return {
        "envelope_correlation_with_target_calibrated": _safe_correlation(
            seated_envelope, projected_envelope
        ),
        "envelope_correlation_with_original": _safe_correlation(
            original_envelope, projected_envelope
        ),
        "interchannel_correlation_mean_absolute_change": float(
            np.mean(np.abs(projected_corr[triangle] - seated_corr[triangle]))
        ),
        "rms_ratio_to_target_calibrated": float(
            np.sqrt(np.mean(projected**2)) / max(seated_rms, 1e-12)
        ),
        "spectral_centroid_shift_hz": float(features_projected[5] - features_seated[5]),
        "spectral_entropy_change": float(features_projected[6] - features_seated[6]),
        "realized_standing_artifact_rms_ratio": float(
            np.sqrt(np.mean(artifact**2)) / max(seated_rms, 1e-12)
        ),
    }


def _interval(values: list[float]) -> dict[str, float]:
    low, median, high = np.quantile(values, (0.025, 0.5, 0.975))
    return {
        "median": float(median),
        "p2_5": float(low),
        "p97_5": float(high),
        "interval_type": "central_95_percent_projected_simulation_interval",
    }


def _sensitivity(
    draw_inputs: dict[str, list[float]], draw_metrics: dict[str, list[float]]
) -> dict[str, dict[str, float | None]]:
    result: dict[str, dict[str, float | None]] = {}
    for metric_name, metric_values in draw_metrics.items():
        result[metric_name] = {}
        y = np.asarray(metric_values, dtype=float)
        for input_name, input_values in draw_inputs.items():
            x = np.asarray(input_values, dtype=float)
            finite = np.isfinite(x) & np.isfinite(y)
            if np.sum(finite) < 3 or np.unique(x[finite]).size < 2:
                result[metric_name][input_name] = None
            else:
                rho = spearmanr(x[finite], y[finite]).statistic
                result[metric_name][input_name] = (
                    None if not np.isfinite(rho) else float(rho)
                )
    return result


def run_standing_projection(
    source_records: list[RecordWindows],
    parameters: SimulationParameters,
    calibration_config: ExperimentConfig,
    standing_config: dict[str, Any],
    event_statistics: dict[str, Any],
    scenario: str,
    draws: int,
    calibration_seed_offset: int,
    projection_seed_offset: int = 0,
) -> StandingProjectionResult:
    """Run Monte Carlo projections without modifying or optimizing fitted parameters."""
    if draws < 1:
        raise ValueError("Standing projection draws must be positive")
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown standing scenario {scenario!r}")
    traces: list[tuple[RecordWindows, int, np.ndarray, SimulatedWindowTrace]] = []
    for record in source_records:
        for window_index, original in enumerate(record.windows):
            seed = simulation_seed(
                calibration_config.seed + calibration_seed_offset,
                record.record_id,
                window_index,
            )
            trace = simulate_window_with_trace(
                original,
                record.fs,
                parameters,
                calibration_config,
                np.random.default_rng(seed),
            )
            traces.append((record, window_index, original, trace))
    if not traces:
        raise ValueError("No source windows were supplied for standing projection")

    seed = int(standing_config["seed"]) + projection_seed_offset
    multiplier_low, multiplier_high = (
        float(x) for x in standing_config["heart_rate_multiplier_range"]
    )
    quiet_rate = float(event_statistics["quiet_event_rate_per_hour"])
    movement_rate = float(event_statistics["movement_associated_event_rate_per_hour"])
    amplitude_samples = event_statistics["amplitude_ratio_samples"]
    decay_samples = event_statistics["decay_seconds_samples"]
    transition_amplitude_samples = event_statistics.get(
        "transition_amplitude_ratio_samples", amplitude_samples
    )
    transition_decay_samples = event_statistics.get(
        "transition_decay_seconds_samples", decay_samples
    )
    envelope_cutoff = float(standing_config["envelope_lowpass_hz"])
    samples: list[dict[str, Any]] = []
    draw_metrics = {name: [] for name in METRIC_NAMES}
    draw_inputs = {name: [] for name in SENSITIVITY_INPUTS}
    demo_signals: list[np.ndarray] = []
    representative: WindowProjection | None = None

    for draw_index in range(draws):
        draw_rng = np.random.default_rng(seed + draw_index)
        multiplier = float(draw_rng.uniform(multiplier_low, multiplier_high))
        interpolation = float(draw_rng.uniform())
        rate = (1 - interpolation) * quiet_rate + interpolation * movement_rate
        per_window_metrics: list[dict[str, float]] = []
        per_window_samples: list[dict[str, Any]] = []
        for trace_index, (record, window_index, original, trace) in enumerate(traces):
            artifact_seed = int(draw_rng.integers(0, np.iinfo(np.uint32).max))
            projection = project_window(
                trace,
                record.fs,
                scenario,
                multiplier,
                rate,
                amplitude_samples,
                decay_samples,
                transition_amplitude_samples,
                transition_decay_samples,
                np.random.default_rng(artifact_seed),
                calibration_config,
                standing_config,
            )
            metrics = _window_metrics(
                original,
                trace.final_signal,
                projection.final_signal,
                record.fs,
                envelope_cutoff,
            )
            row = {
                "draw": draw_index,
                "scenario": scenario,
                "status": "projected_not_validated",
                "source_record_id": record.record_id,
                "source_subject_id": record.subject_id,
                "source_window_index": window_index,
                "artifact_seed": artifact_seed,
                "event_rate_interpolation_u": interpolation,
                **projection.sampled,
                "metrics": metrics,
            }
            samples.append(row)
            per_window_samples.append(row)
            per_window_metrics.append(metrics)
            if trace_index == 0:
                demo_signals.append(projection.final_signal)
                if representative is None:
                    representative = projection

        for metric_name in METRIC_NAMES:
            draw_metrics[metric_name].append(
                float(np.mean([metrics[metric_name] for metrics in per_window_metrics]))
            )
        draw_inputs["heart_rate_multiplier"].append(multiplier)
        draw_inputs["standing_hr_bpm"].append(
            float(np.mean([row["standing_hr_bpm"] for row in per_window_samples]))
        )
        draw_inputs["electrode_event_rate_per_hour"].append(rate)
        draw_inputs["event_count"].append(
            float(np.mean([row["event_count"] for row in per_window_samples]))
        )
        draw_inputs["mean_jump_amplitude_ratio"].append(
            float(np.mean([row["mean_jump_amplitude_ratio"] for row in per_window_samples]))
        )
        draw_inputs["mean_decay_seconds"].append(
            float(np.mean([row["mean_decay_seconds"] for row in per_window_samples]))
        )
        cadences = [
            row["walking_cadence_steps_per_minute"]
            for row in per_window_samples
            if row["walking_cadence_steps_per_minute"] is not None
        ]
        draw_inputs["walking_cadence_steps_per_minute"].append(
            float(np.mean(cadences)) if cadences else float("nan")
        )

    demo_stack = np.asarray(demo_signals)
    demo_record, demo_index, demo_original, demo_trace = traces[0]
    assert representative is not None
    demo = {
        "original": demo_original,
        "target_calibrated": demo_trace.final_signal,
        "standing_median": np.quantile(demo_stack, 0.5, axis=0),
        "standing_lower": np.quantile(demo_stack, 0.025, axis=0),
        "standing_upper": np.quantile(demo_stack, 0.975, axis=0),
        "target_calibrated_envelope": contraction_envelope(
            demo_trace.final_signal, demo_record.fs, envelope_cutoff
        ),
        "standing_envelope_median": np.quantile(
            [contraction_envelope(value, demo_record.fs, envelope_cutoff) for value in demo_stack],
            0.5,
            axis=0,
        ),
        "standing_envelope_lower": np.quantile(
            [contraction_envelope(value, demo_record.fs, envelope_cutoff) for value in demo_stack],
            0.025,
            axis=0,
        ),
        "standing_envelope_upper": np.quantile(
            [contraction_envelope(value, demo_record.fs, envelope_cutoff) for value in demo_stack],
            0.975,
            axis=0,
        ),
        "representative_cardiac_component": representative.cardiac_component,
        "representative_electrode_component": representative.electrode_component,
        "representative_final": representative.final_signal,
        "fs": np.asarray(demo_record.fs),
        "source_record_id": np.asarray(demo_record.record_id),
        "source_subject_id": np.asarray(demo_record.subject_id),
        "source_window_index": np.asarray(demo_index),
    }
    summary = {
        "scenario": scenario,
        "status": "projected_not_validated",
        "n_simulation_draws": draws,
        "source_window_count_per_draw": len(traces),
        "source_subject_count": len({record.subject_id for record, _, _, _ in traces}),
        "simulator_version": standing_config["simulator_version"],
        "random_seed": seed,
        "fixed_target_domain_calibration": True,
        "standing_mmd_optimization_performed": False,
        "assumptions": {
            "heart_rate_multiplier_range": [multiplier_low, multiplier_high],
            "heart_rate_sampling": "uniform_sensitivity_sampling_modeling_assumption",
            "cardiac_amplitude": "constant_fitted_amplitude_assumption",
            "electrode_rate_model": (
                "uniform interpolation between target-training quiet and "
                "movement-associated observed rates"
            ),
            "walking_model": (
                "target-derived event morphology placed at sampled walking-step "
                "opportunities; not measured pregnant walking EHG"
            ),
        },
        "event_statistics": event_statistics,
        "metrics": {name: _interval(values) for name, values in draw_metrics.items()},
        "contraction_detector_auc": {
            "status": "unavailable",
            "reason": (
                "Projected held-out source windows do not provide aligned, independently "
                "verified contraction labels. No pseudo-label AUC was fabricated."
            ),
        },
        "drivers_spearman_rho": _sensitivity(draw_inputs, draw_metrics),
        "interval_interpretation": (
            "Central 95% projected simulation intervals conditional on sampled standing "
            "assumptions; not clinical confidence intervals and not validated standing coverage."
        ),
        "demo_band_interpretation": (
            "Pointwise central 95% simulation band; not a simultaneous confidence band."
        ),
    }
    return StandingProjectionResult(summary=summary, samples=samples, demo=demo)


def combine_nested_projection_results(
    fold_results: list[tuple[int, StandingProjectionResult]],
) -> StandingProjectionResult:
    """Combine fold-specific held-out projections into one nested-CV analysis."""
    if not fold_results:
        raise ValueError("At least one fold result is required")
    first_summary = fold_results[0][1].summary
    draws = int(first_summary["n_simulation_draws"])
    scenario = str(first_summary["scenario"])
    combined_samples: list[dict[str, Any]] = []
    for fold, result in fold_results:
        if result.summary["scenario"] != scenario:
            raise ValueError("Cannot combine different standing scenarios")
        if int(result.summary["n_simulation_draws"]) != draws:
            raise ValueError("Cannot combine fold results with different draw counts")
        for sample in result.samples:
            combined_samples.append({"calibration_fold": fold, **sample})

    draw_metrics = {name: [] for name in METRIC_NAMES}
    draw_inputs = {name: [] for name in SENSITIVITY_INPUTS}
    samples_by_draw: dict[int, list[dict[str, Any]]] = {}
    for row in combined_samples:
        samples_by_draw.setdefault(int(row["draw"]), []).append(row)
    for draw_index in range(draws):
        rows = samples_by_draw.get(draw_index, [])
        if not rows:
            raise RuntimeError(f"Nested projection draw {draw_index} has no samples")
        for metric_name in METRIC_NAMES:
            draw_metrics[metric_name].append(
                float(np.mean([row["metrics"][metric_name] for row in rows]))
            )
        for input_name in SENSITIVITY_INPUTS:
            values = [
                row[input_name]
                for row in rows
                if row[input_name] is not None and np.isfinite(row[input_name])
            ]
            draw_inputs[input_name].append(
                float(np.mean(values)) if values else float("nan")
            )

    summary = {
        **first_summary,
        "nested_cross_validation_projection": True,
        "calibration_folds": [fold for fold, _ in fold_results],
        "n_simulation_draws": draws,
        "source_window_count_per_draw": sum(
            int(result.summary["source_window_count_per_draw"])
            for _, result in fold_results
        ),
        "source_subject_count": len(
            {row["source_subject_id"] for row in combined_samples}
        ),
        "random_seed_by_fold": {
            str(fold): int(result.summary["random_seed"])
            for fold, result in fold_results
        },
        "metrics": {name: _interval(values) for name, values in draw_metrics.items()},
        "drivers_spearman_rho": _sensitivity(draw_inputs, draw_metrics),
    }
    summary.pop("event_statistics", None)
    return StandingProjectionResult(
        summary=summary,
        samples=combined_samples,
        demo=fold_results[0][1].demo,
    )
