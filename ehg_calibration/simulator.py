"""Five-effect stochastic lying-to-seated EHG simulator."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, sosfiltfilt

from .config import ExperimentConfig, PARAMETER_NAMES
from .types import RecordWindows


@dataclass(frozen=True)
class SimulationParameters:
    heart: float
    breathing: float
    fetal_movement: float
    muscle: float
    electrode_shift: float

    @classmethod
    def from_array(cls, values: np.ndarray | list[float]) -> "SimulationParameters":
        if len(values) != len(PARAMETER_NAMES):
            raise ValueError(f"Expected {len(PARAMETER_NAMES)} parameters")
        return cls(*(float(value) for value in values))

    def as_array(self) -> np.ndarray:
        return np.asarray(
            [self.heart, self.breathing, self.fetal_movement, self.muscle, self.electrode_shift],
            dtype=float,
        )

    def as_dict(self) -> dict[str, float]:
        return {
            name: float(value)
            for name, value in zip(PARAMETER_NAMES, self.as_array(), strict=True)
        }


@dataclass(frozen=True)
class SimulatedWindowTrace:
    """Components needed to alter cardiac frequency without refitting calibration."""

    final_signal: np.ndarray
    transformed_cardiac_component: np.ndarray
    cardiac_reference_hz: float
    cardiac_phase: float
    cardiac_channel_amplitude: np.ndarray
    electrode_gain_factors: np.ndarray
    electrode_mixing: np.ndarray

    def transform_component(self, component: np.ndarray) -> np.ndarray:
        return (
            component * self.electrode_gain_factors[:, None]
            + self.electrode_mixing @ component
        )


def simulation_seed(base_seed: int, record_id: str, window_index: int) -> int:
    """Return the stable per-window seed used by the calibration simulator."""
    payload = f"{base_seed}:{record_id}:{window_index}".encode()
    digest = hashlib.blake2b(payload, digest_size=8).digest()
    return int.from_bytes(digest, "little")


def _normalized_strengths(
    params: SimulationParameters, config: ExperimentConfig
) -> dict[str, float]:
    normalized: dict[str, float] = {}
    for name, value in params.as_dict().items():
        low, high = config.parameter_ranges[name]
        if value < low - 1e-12 or value > high + 1e-12:
            raise ValueError(f"{name}={value} is outside configured range [{low}, {high}]")
        normalized[name] = 0.0 if high == low else (value - low) / (high - low)
    return normalized


def simulate_window(
    window: np.ndarray,
    fs: float,
    params: SimulationParameters,
    config: ExperimentConfig,
    rng: np.random.Generator,
) -> np.ndarray:
    """Apply reproducible stochastic artifacts to one EHG window."""
    return simulate_window_with_trace(window, fs, params, config, rng).final_signal


def simulate_window_with_trace(
    window: np.ndarray,
    fs: float,
    params: SimulationParameters,
    config: ExperimentConfig,
    rng: np.random.Generator,
) -> SimulatedWindowTrace:
    """Simulate a window while retaining the fitted cardiac/electrode geometry."""
    strengths = _normalized_strengths(params, config)
    if all(value == 0 for value in strengths.values()):
        unchanged = np.asarray(window, dtype=float).copy()
        channels = unchanged.shape[0]
        return SimulatedWindowTrace(
            final_signal=unchanged,
            transformed_cardiac_component=np.zeros_like(unchanged),
            cardiac_reference_hz=float(np.mean(config.physiology.heart_bpm) / 60.0),
            cardiac_phase=0.0,
            cardiac_channel_amplitude=np.zeros(channels),
            electrode_gain_factors=np.ones(channels),
            electrode_mixing=np.zeros((channels, channels)),
        )

    source = np.asarray(window, dtype=float)
    channels, samples = source.shape
    time = np.arange(samples, dtype=float) / fs
    duration_minutes = samples / fs / 60.0
    rms = np.sqrt(np.mean((source - source.mean(axis=-1, keepdims=True)) ** 2, axis=-1))
    rms = np.maximum(rms, 1e-12)
    result = source.copy()
    limits = config.physiology.max_artifact_rms_ratio

    # The input source has already passed the experiment's preprocessing
    # band-pass. Components are scaled before they are added; no final
    # normalization is applied to the combined signal.

    # Maternal cardiac contamination: shared quasi-periodic source with
    # channel-specific coupling and a weak second harmonic.
    heart_hz = rng.uniform(*config.physiology.heart_bpm) / 60.0
    phase = rng.uniform(0, 2 * np.pi)
    heart_wave = np.sin(2 * np.pi * heart_hz * time + phase)
    if 2 * heart_hz < fs / 2:
        heart_wave += 0.35 * np.sin(4 * np.pi * heart_hz * time + 2 * phase)
    heart_wave /= np.sqrt(np.mean(heart_wave**2)) + 1e-12
    coupling = rng.uniform(0.7, 1.3, size=channels)
    cardiac_channel_amplitude = (
        strengths["heart"]
        * limits["heart"]
        * rms
        * coupling
    )
    heart_component = cardiac_channel_amplitude[:, None] * heart_wave[None, :]
    result += heart_component

    # Breathing: either the legacy RMS cap or the explicitly marked
    # paper-inspired quarter-standard-deviation extrapolation.
    breathing_hz = rng.uniform(*config.physiology.breathing_bpm) / 60.0
    for channel in range(channels):
        breath = np.sin(2 * np.pi * breathing_hz * time + phase + rng.normal(0, 0.15))
        if config.physiology.respiratory_amplitude_mode == "paper_sd_quarter_extrapolation":
            template_std = np.std(breath, ddof=0)
            if template_std <= 1e-12:
                respiratory_component = np.zeros_like(breath)
            else:
                r_unit = (breath - np.mean(breath)) / template_std
                respiratory_component = (
                    config.physiology.respiratory_amplitude_fraction
                    * np.std(source[channel], ddof=0)
                    * r_unit
                )
        else:
            respiratory_component = limits["breathing"] * rms[channel] * breath
        result[channel] += strengths["breathing"] * respiratory_component

    # Fetal movement: sparse Gaussian-windowed, low-frequency transients.
    maximum_fetal_rate = config.physiology.fetal_events_per_minute[1]
    fetal_count = rng.poisson(maximum_fetal_rate * duration_minutes)
    for _ in range(fetal_count):
        center = rng.uniform(0, time[-1])
        duration = rng.uniform(*config.physiology.fetal_event_duration_seconds)
        envelope = np.exp(-0.5 * ((time - center) / max(duration / 4, 1 / fs)) ** 2)
        carrier_hz = rng.uniform(0.35, min(2.5, fs * 0.4))
        transient = envelope * np.sin(2 * np.pi * carrier_hz * (time - center))
        spatial = rng.normal(0, 1, size=channels)
        spatial /= np.max(np.abs(spatial)) + 1e-12
        result += (
            strengths["fetal_movement"]
            * limits["fetal_movement"]
            * rms[:, None]
            * spatial[:, None]
            * transient[None, :]
        )

    # Maternal skeletal muscle: band-limited noise in sparse smooth bursts.
    maximum_muscle_rate = config.physiology.muscle_bursts_per_minute[1]
    muscle_count = rng.poisson(maximum_muscle_rate * duration_minutes)
    muscle_sos = butter(3, (0.5, min(3.0, fs / 2 - 0.01)), btype="bandpass", fs=fs, output="sos")
    for _ in range(muscle_count):
        center = rng.uniform(0, time[-1])
        duration = rng.uniform(*config.physiology.muscle_burst_duration_seconds)
        envelope = np.exp(-0.5 * ((time - center) / max(duration / 4, 1 / fs)) ** 2)
        noise = sosfiltfilt(muscle_sos, rng.normal(size=(channels, samples)), axis=-1)
        noise /= np.sqrt(np.mean(noise**2, axis=-1, keepdims=True)) + 1e-12
        result += (
            strengths["muscle"]
            * limits["muscle"]
            * rms[:, None]
            * noise
            * envelope[None, :]
        )

    # Electrode displacement: gain change, spatial crosstalk, and contact noise.
    electrode = strengths["electrode_shift"]
    gain_delta = rng.uniform(-1, 1, size=channels) * config.physiology.max_electrode_gain_change
    electrode_gain_factors = 1 + electrode * gain_delta
    shifted = result * electrode_gain_factors[:, None]
    electrode_mixing = np.zeros((channels, channels), dtype=float)
    if channels > 1:
        mixing = rng.normal(size=(channels, channels))
        np.fill_diagonal(mixing, 0)
        row_scale = np.sum(np.abs(mixing), axis=1, keepdims=True) + 1e-12
        mixing /= row_scale
        electrode_mixing = (
            electrode * config.physiology.max_electrode_crosstalk * mixing
        )
        shifted += electrode_mixing @ result
    contact = rng.normal(size=(channels, samples))
    contact_sos = butter(2, min(0.8, fs / 2 - 0.01), btype="lowpass", fs=fs, output="sos")
    contact = sosfiltfilt(contact_sos, contact, axis=-1)
    contact /= np.sqrt(np.mean(contact**2, axis=-1, keepdims=True)) + 1e-12
    shifted += (
        electrode
        * limits["electrode_noise"]
        * rms[:, None]
        * contact
    )
    transformed_heart = (
        heart_component * electrode_gain_factors[:, None]
        + electrode_mixing @ heart_component
    )
    return SimulatedWindowTrace(
        final_signal=shifted,
        transformed_cardiac_component=transformed_heart,
        cardiac_reference_hz=float(heart_hz),
        cardiac_phase=float(phase),
        cardiac_channel_amplitude=cardiac_channel_amplitude,
        electrode_gain_factors=electrode_gain_factors,
        electrode_mixing=electrode_mixing,
    )


def simulate_records(
    records: list[RecordWindows],
    params: SimulationParameters,
    config: ExperimentConfig,
    seed_offset: int = 0,
) -> list[RecordWindows]:
    """Simulate all windows using common random numbers across candidates."""
    simulated: list[RecordWindows] = []
    for record in records:
        windows = []
        for index, window in enumerate(record.windows):
            seed = simulation_seed(config.seed + seed_offset, record.record_id, index)
            windows.append(
                simulate_window(window, record.fs, params, config, np.random.default_rng(seed))
            )
        simulated.append(
            RecordWindows(
                record_id=record.record_id,
                subject_id=record.subject_id,
                windows=np.asarray(windows),
                fs=record.fs,
            )
        )
    return simulated


def preservation_penalty(
    original: list[RecordWindows],
    simulated: list[RecordWindows],
    config: ExperimentConfig,
) -> float:
    """Penalize low correlation and excessive RMS changes."""
    correlations: list[float] = []
    rms_changes: list[float] = []
    for before_record, after_record in zip(original, simulated, strict=True):
        for before, after in zip(before_record.windows, after_record.windows, strict=True):
            for original_channel, simulated_channel in zip(before, after, strict=True):
                if np.std(original_channel) <= 1e-12 or np.std(simulated_channel) <= 1e-12:
                    correlations.append(0.0)
                else:
                    correlations.append(float(np.corrcoef(original_channel, simulated_channel)[0, 1]))
                before_rms = np.sqrt(np.mean(original_channel**2)) + 1e-12
                after_rms = np.sqrt(np.mean(simulated_channel**2))
                rms_changes.append(abs(after_rms / before_rms - 1.0))
    minimum = config.regularization.minimum_waveform_correlation
    maximum_change = config.regularization.maximum_rms_ratio_change
    correlation_loss = np.mean(np.maximum(0.0, minimum - np.asarray(correlations)) ** 2)
    rms_loss = np.mean(np.maximum(0.0, np.asarray(rms_changes) - maximum_change) ** 2)
    return float(correlation_loss + rms_loss)


def achieved_artifact_rms_ratio(
    original: list[RecordWindows], simulated: list[RecordWindows]
) -> float:
    """Measure total achieved artifact RMS relative to the processed source."""
    ratios: list[float] = []
    for before_record, after_record in zip(original, simulated, strict=True):
        for before, after in zip(before_record.windows, after_record.windows, strict=True):
            source = before - np.mean(before, axis=-1, keepdims=True)
            artifact = after - before
            source_rms = np.sqrt(np.mean(source**2, axis=-1))
            artifact_rms = np.sqrt(np.mean(artifact**2, axis=-1))
            ratios.extend((artifact_rms / np.maximum(source_rms, 1e-12)).tolist())
    return float(np.mean(ratios)) if ratios else 0.0
