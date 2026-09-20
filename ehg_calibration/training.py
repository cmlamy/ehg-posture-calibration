"""Bounded simulator optimization with validation-based candidate selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from scipy.optimize import differential_evolution
from sklearn.preprocessing import StandardScaler

from .config import ExperimentConfig
from .features import extract_features
from .mmd import median_bandwidth, multi_kernel_mmd2
from .simulator import (
    SimulationParameters,
    preservation_penalty,
    simulate_records,
)
from .types import RecordWindows


@dataclass(frozen=True)
class Candidate:
    parameters: SimulationParameters
    training_loss: float
    training_mmd2: float
    validation_loss: float
    validation_mmd2: float
    preservation_penalty: float
    restart: int

    @property
    def training_mmd(self) -> float:
        """Unsquared training MMD for reporting."""
        return float(np.sqrt(self.training_mmd2))

    @property
    def validation_mmd(self) -> float:
        """Unsquared validation MMD for reporting."""
        return float(np.sqrt(self.validation_mmd2))


@dataclass(frozen=True)
class TrainedCalibration:
    selected: Candidate
    candidates: tuple[Candidate, ...]
    scaler: StandardScaler
    bandwidths: tuple[float, ...]


def flatten_features(records: list[RecordWindows]) -> np.ndarray:
    matrices = [extract_features(record.windows, record.fs) for record in records]
    if not matrices:
        raise ValueError("No records supplied")
    return np.vstack(matrices)


def features_by_subject(records: list[RecordWindows]) -> dict[str, np.ndarray]:
    """Extract and combine feature matrices for each subject."""
    collected: dict[str, list[np.ndarray]] = {}
    for record in records:
        collected.setdefault(record.subject_id, []).append(
            extract_features(record.windows, record.fs)
        )
    return {subject: np.vstack(parts) for subject, parts in collected.items()}


def fit_training_geometry(
    lying_train: list[RecordWindows],
    seated_train: list[RecordWindows],
    config: ExperimentConfig,
) -> tuple[StandardScaler, tuple[float, ...]]:
    """Fit scaling and MMD kernel widths using training data only."""
    real = np.vstack([flatten_features(lying_train), flatten_features(seated_train)])
    scaler = StandardScaler().fit(real)
    standardized = scaler.transform(real)
    base = median_bandwidth(standardized)
    bandwidths = tuple(base * value for value in config.mmd_bandwidth_multipliers)
    return scaler, bandwidths


def score_parameters(
    params: SimulationParameters,
    lying: list[RecordWindows],
    seated_features_scaled: np.ndarray,
    scaler: StandardScaler,
    bandwidths: tuple[float, ...],
    config: ExperimentConfig,
    seed_offset: int,
) -> tuple[float, float, float]:
    """Return total loss, MMD² and preservation penalty."""
    simulated = simulate_records(lying, params, config, seed_offset=seed_offset)
    simulated_features = scaler.transform(flatten_features(simulated))
    mmd2 = multi_kernel_mmd2(simulated_features, seated_features_scaled, bandwidths)
    preservation = preservation_penalty(lying, simulated, config)

    normalized = []
    for value, (low, high) in zip(params.as_array(), config.bounds, strict=True):
        normalized.append(0.0 if high == low else (value - low) / (high - low))
    parameter_penalty = float(np.mean(np.square(normalized)))
    loss = (
        mmd2
        + config.regularization.preservation_weight * preservation
        + config.regularization.parameter_l2_weight * parameter_penalty
    )
    return float(loss), mmd2, preservation


def train_calibration(
    lying_train: list[RecordWindows],
    seated_train: list[RecordWindows],
    lying_validation: list[RecordWindows],
    seated_validation: list[RecordWindows],
    config: ExperimentConfig,
    progress: Callable[[str], None] | None = None,
) -> TrainedCalibration:
    """Optimize candidates on train and choose one using validation loss with MMD²."""
    progress = progress or (lambda _: None)
    scaler, bandwidths = fit_training_geometry(lying_train, seated_train, config)
    seated_train_scaled = scaler.transform(flatten_features(seated_train))
    seated_validation_scaled = scaler.transform(flatten_features(seated_validation))
    candidates: list[Candidate] = []

    for restart in range(config.optimization.restarts):
        train_seed_offset = 10_000 * (restart + 1)

        def objective(values: np.ndarray) -> float:
            loss, _, _ = score_parameters(
                SimulationParameters.from_array(values),
                lying_train,
                seated_train_scaled,
                scaler,
                bandwidths,
                config,
                train_seed_offset,
            )
            return loss

        progress(f"optimizing restart {restart + 1}/{config.optimization.restarts}")
        result = differential_evolution(
            objective,
            bounds=config.bounds,
            seed=config.seed + restart,
            popsize=config.optimization.population_size,
            maxiter=config.optimization.max_iterations,
            tol=config.optimization.tolerance,
            # The stochastic transient count makes this objective mildly
            # non-smooth. L-BFGS polishing adds many evaluations but provides
            # little benefit, so validation across restarts is preferable.
            polish=False,
            updating="immediate",
            workers=1,
        )
        params = SimulationParameters.from_array(result.x)
        train_loss, train_mmd2, _ = score_parameters(
            params,
            lying_train,
            seated_train_scaled,
            scaler,
            bandwidths,
            config,
            train_seed_offset,
        )
        validation_loss, validation_mmd2, preservation = score_parameters(
            params,
            lying_validation,
            seated_validation_scaled,
            scaler,
            bandwidths,
            config,
            seed_offset=50_000,
        )
        candidate = Candidate(
            parameters=params,
            training_loss=train_loss,
            training_mmd2=train_mmd2,
            validation_loss=validation_loss,
            validation_mmd2=validation_mmd2,
            preservation_penalty=preservation,
            restart=restart,
        )
        candidates.append(candidate)
        progress(
            f"restart {restart + 1}: train MMD²={train_mmd2:.6f} "
            f"(MMD={np.sqrt(train_mmd2):.6f}), validation MMD²="
            f"{validation_mmd2:.6f} (MMD={np.sqrt(validation_mmd2):.6f})"
        )

    selected = min(candidates, key=lambda candidate: candidate.validation_loss)
    return TrainedCalibration(
        selected=selected,
        candidates=tuple(candidates),
        scaler=scaler,
        bandwidths=bandwidths,
    )
