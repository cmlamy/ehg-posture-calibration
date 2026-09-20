"""Validated JSON experiment configuration."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PARAMETER_NAMES = (
    "heart",
    "breathing",
    "fetal_movement",
    "muscle",
    "electrode_shift",
)


@dataclass(frozen=True)
class PhysiologyConfig:
    heart_bpm: tuple[float, float]
    breathing_bpm: tuple[float, float]
    fetal_events_per_minute: tuple[float, float]
    fetal_event_duration_seconds: tuple[float, float]
    muscle_bursts_per_minute: tuple[float, float]
    muscle_burst_duration_seconds: tuple[float, float]
    max_electrode_gain_change: float
    max_electrode_crosstalk: float
    max_artifact_rms_ratio: dict[str, float]
    respiratory_amplitude_mode: str = "legacy_rms_cap"
    respiratory_amplitude_fraction: float = 0.25
    evidence_status: dict[str, str] = field(default_factory=dict)
    reference_statistics: dict[str, Any] = field(default_factory=dict)
    empirical_observations: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RegularizationConfig:
    parameter_l2_weight: float
    preservation_weight: float
    minimum_waveform_correlation: float
    maximum_rms_ratio_change: float


@dataclass(frozen=True)
class OptimizationConfig:
    restarts: int
    population_size: int
    max_iterations: int
    tolerance: float


@dataclass(frozen=True)
class ExperimentConfig:
    schema_version: int
    profile_name: str
    profile_version: int
    seed: int
    target_fs: float
    bandpass_hz: tuple[float, float]
    trim_seconds: float
    window_seconds: float
    max_windows_per_subject: int
    max_subjects_per_domain: int
    split_fractions: tuple[float, float, float]
    mmd_bandwidth_multipliers: tuple[float, ...]
    parameter_ranges: dict[str, tuple[float, float]]
    physiology: PhysiologyConfig
    regularization: RegularizationConfig
    optimization: OptimizationConfig
    bootstrap_iterations: int

    @property
    def bounds(self) -> tuple[tuple[float, float], ...]:
        return tuple(self.parameter_ranges[name] for name in PARAMETER_NAMES)


def _pair(value: Any, name: str, *, allow_equal: bool = False) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{name} must be a two-element JSON array")
    low, high = float(value[0]), float(value[1])
    if (allow_equal and low > high) or (not allow_equal and low >= high):
        relation = "low <= high" if allow_equal else "low < high"
        raise ValueError(f"{name} must have {relation}")
    return low, high


def _profile_payload(raw: dict[str, Any], profile: str | None) -> tuple[int, str, int, dict[str, Any]]:
    if "profiles" not in raw:
        return 1, "legacy_v1", 1, raw
    schema_version = int(raw.get("schema_version", 2))
    profiles = raw["profiles"]
    selected = profile or raw.get("active_profile", "exploratory")
    if selected not in profiles:
        raise ValueError(f"Unknown physiology profile {selected!r}; choose {sorted(profiles)}")
    payload = profiles[selected]
    return schema_version, selected, int(payload.get("profile_version", 1)), payload


def load_config(path: str | Path, profile: str | None = None) -> ExperimentConfig:
    """Load and validate a JSON configuration."""
    with Path(path).open(encoding="utf-8") as handle:
        raw = json.load(handle)

    schema_version, profile_name, profile_version, selected = _profile_payload(raw, profile)
    ranges = selected["parameter_ranges"]
    missing = set(PARAMETER_NAMES) - set(ranges)
    extra = set(ranges) - set(PARAMETER_NAMES)
    if missing or extra:
        raise ValueError(f"parameter_ranges mismatch; missing={missing}, extra={extra}")

    physiology = selected["physiology"]
    regularization = raw["regularization"]
    optimization = raw["optimization"]
    fractions = tuple(float(x) for x in raw["split_fractions"])
    if len(fractions) != 3 or any(x <= 0 for x in fractions):
        raise ValueError("split_fractions must contain three positive values")
    if abs(sum(fractions) - 1.0) > 1e-8:
        raise ValueError("split_fractions must sum to 1")

    cfg = ExperimentConfig(
        schema_version=schema_version,
        profile_name=profile_name,
        profile_version=profile_version,
        seed=int(raw["seed"]),
        target_fs=float(raw["target_fs"]),
        bandpass_hz=_pair(raw["bandpass_hz"], "bandpass_hz"),
        trim_seconds=float(raw["trim_seconds"]),
        window_seconds=float(raw["window_seconds"]),
        max_windows_per_subject=int(raw["max_windows_per_subject"]),
        max_subjects_per_domain=int(raw["max_subjects_per_domain"]),
        split_fractions=fractions,
        mmd_bandwidth_multipliers=tuple(
            float(x) for x in raw["mmd_bandwidth_multipliers"]
        ),
        parameter_ranges={
            name: _pair(ranges[name], name, allow_equal=True) for name in PARAMETER_NAMES
        },
        physiology=PhysiologyConfig(
            heart_bpm=_pair(physiology["heart_bpm"], "heart_bpm"),
            breathing_bpm=_pair(
                physiology["breathing_bpm"], "breathing_bpm", allow_equal=True
            ),
            fetal_events_per_minute=_pair(
                physiology["fetal_events_per_minute"], "fetal_events_per_minute"
            ),
            fetal_event_duration_seconds=_pair(
                physiology["fetal_event_duration_seconds"],
                "fetal_event_duration_seconds",
            ),
            muscle_bursts_per_minute=_pair(
                physiology["muscle_bursts_per_minute"], "muscle_bursts_per_minute"
            ),
            muscle_burst_duration_seconds=_pair(
                physiology["muscle_burst_duration_seconds"],
                "muscle_burst_duration_seconds",
            ),
            max_electrode_gain_change=float(physiology["max_electrode_gain_change"]),
            max_electrode_crosstalk=float(physiology["max_electrode_crosstalk"]),
            max_artifact_rms_ratio={
                str(k): float(v)
                for k, v in physiology["max_artifact_rms_ratio"].items()
            },
            respiratory_amplitude_mode=str(
                physiology.get("respiratory_amplitude_mode", "legacy_rms_cap")
            ),
            respiratory_amplitude_fraction=float(
                physiology.get("respiratory_amplitude_fraction", 0.25)
            ),
            evidence_status={
                str(k): str(v) for k, v in selected.get("evidence_status", {}).items()
            },
            reference_statistics=dict(physiology.get("reference_statistics", {})),
            empirical_observations=dict(physiology.get("empirical_observations", {})),
        ),
        regularization=RegularizationConfig(
            parameter_l2_weight=float(regularization["parameter_l2_weight"]),
            preservation_weight=float(regularization["preservation_weight"]),
            minimum_waveform_correlation=float(
                regularization["minimum_waveform_correlation"]
            ),
            maximum_rms_ratio_change=float(
                regularization["maximum_rms_ratio_change"]
            ),
        ),
        optimization=OptimizationConfig(
            restarts=int(optimization["restarts"]),
            population_size=int(optimization["population_size"]),
            max_iterations=int(optimization["max_iterations"]),
            tolerance=float(optimization["tolerance"]),
        ),
        bootstrap_iterations=int(raw["bootstrap_iterations"]),
    )
    _validate(cfg)
    return cfg


def load_effective_config(path: str | Path) -> ExperimentConfig:
    """Load an `effective_config.json` saved by a completed experiment."""
    with Path(path).open(encoding="utf-8") as handle:
        raw = json.load(handle)
    physiology = raw["physiology"]
    regularization = raw["regularization"]
    optimization = raw["optimization"]
    cfg = ExperimentConfig(
        schema_version=int(raw["schema_version"]),
        profile_name=str(raw["profile_name"]),
        profile_version=int(raw["profile_version"]),
        seed=int(raw["seed"]),
        target_fs=float(raw["target_fs"]),
        bandpass_hz=tuple(float(x) for x in raw["bandpass_hz"]),
        trim_seconds=float(raw["trim_seconds"]),
        window_seconds=float(raw["window_seconds"]),
        max_windows_per_subject=int(raw["max_windows_per_subject"]),
        max_subjects_per_domain=int(raw["max_subjects_per_domain"]),
        split_fractions=tuple(float(x) for x in raw["split_fractions"]),
        mmd_bandwidth_multipliers=tuple(
            float(x) for x in raw["mmd_bandwidth_multipliers"]
        ),
        parameter_ranges={
            str(name): tuple(float(x) for x in bounds)
            for name, bounds in raw["parameter_ranges"].items()
        },
        physiology=PhysiologyConfig(
            heart_bpm=tuple(float(x) for x in physiology["heart_bpm"]),
            breathing_bpm=tuple(float(x) for x in physiology["breathing_bpm"]),
            fetal_events_per_minute=tuple(
                float(x) for x in physiology["fetal_events_per_minute"]
            ),
            fetal_event_duration_seconds=tuple(
                float(x) for x in physiology["fetal_event_duration_seconds"]
            ),
            muscle_bursts_per_minute=tuple(
                float(x) for x in physiology["muscle_bursts_per_minute"]
            ),
            muscle_burst_duration_seconds=tuple(
                float(x) for x in physiology["muscle_burst_duration_seconds"]
            ),
            max_electrode_gain_change=float(
                physiology["max_electrode_gain_change"]
            ),
            max_electrode_crosstalk=float(physiology["max_electrode_crosstalk"]),
            max_artifact_rms_ratio={
                str(key): float(value)
                for key, value in physiology["max_artifact_rms_ratio"].items()
            },
            respiratory_amplitude_mode=str(
                physiology.get("respiratory_amplitude_mode", "legacy_rms_cap")
            ),
            respiratory_amplitude_fraction=float(
                physiology.get("respiratory_amplitude_fraction", 0.25)
            ),
            evidence_status=dict(physiology.get("evidence_status", {})),
            reference_statistics=dict(physiology.get("reference_statistics", {})),
            empirical_observations=dict(physiology.get("empirical_observations", {})),
        ),
        regularization=RegularizationConfig(
            parameter_l2_weight=float(regularization["parameter_l2_weight"]),
            preservation_weight=float(regularization["preservation_weight"]),
            minimum_waveform_correlation=float(
                regularization["minimum_waveform_correlation"]
            ),
            maximum_rms_ratio_change=float(
                regularization["maximum_rms_ratio_change"]
            ),
        ),
        optimization=OptimizationConfig(
            restarts=int(optimization["restarts"]),
            population_size=int(optimization["population_size"]),
            max_iterations=int(optimization["max_iterations"]),
            tolerance=float(optimization["tolerance"]),
        ),
        bootstrap_iterations=int(raw["bootstrap_iterations"]),
    )
    _validate(cfg)
    return cfg


def _validate(cfg: ExperimentConfig) -> None:
    low, high = cfg.bandpass_hz
    if low <= 0 or high >= cfg.target_fs / 2:
        raise ValueError("bandpass_hz must lie between 0 and the target Nyquist rate")
    if cfg.max_windows_per_subject < 1:
        raise ValueError("max_windows_per_subject must be positive")
    if cfg.max_subjects_per_domain < 3:
        raise ValueError("max_subjects_per_domain must be at least three")
    if cfg.optimization.restarts < 1:
        raise ValueError("optimization.restarts must be positive")
    if cfg.physiology.respiratory_amplitude_mode not in {
        "legacy_rms_cap",
        "paper_sd_quarter_extrapolation",
    }:
        raise ValueError("Unknown respiratory_amplitude_mode")
    if cfg.physiology.respiratory_amplitude_fraction < 0:
        raise ValueError("respiratory_amplitude_fraction must be non-negative")
    if not 0 <= cfg.regularization.minimum_waveform_correlation <= 1:
        raise ValueError("minimum_waveform_correlation must be in [0, 1]")
