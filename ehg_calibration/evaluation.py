"""Held-out calibration evaluation."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import ExperimentConfig
from .mmd import multi_kernel_mmd2
from .simulator import achieved_artifact_rms_ratio, preservation_penalty, simulate_records
from .training import TrainedCalibration, features_by_subject
from .types import RecordWindows


@dataclass(frozen=True)
class SplitMetrics:
    raw_mmd2: float
    calibrated_mmd2: float
    mmd2_reduction: float
    relative_mmd2_reduction: float
    raw_mmd: float
    calibrated_mmd: float
    mmd_reduction: float
    relative_mmd_reduction: float
    raw_domain_auc: float | None
    calibrated_domain_auc: float | None
    preservation_penalty: float
    achieved_artifact_rms_ratio: float
    simulation_seed_offset: int
    bootstrap_mmd2_reduction_ci95: tuple[float, float] | None = None
    bootstrap_mmd_reduction_ci95: tuple[float, float] | None = None


@dataclass(frozen=True)
class BootstrapReductionSamples:
    """Paired subject-bootstrap reductions on squared and unsquared scales."""

    mmd2: np.ndarray
    mmd: np.ndarray


def _stack(mapping: dict[str, np.ndarray]) -> np.ndarray:
    if not mapping:
        raise ValueError("Feature mapping is empty")
    return np.vstack(list(mapping.values()))


def _domain_auc(
    lying: dict[str, np.ndarray], seated: dict[str, np.ndarray], seed: int
) -> float | None:
    minimum_subjects = min(len(lying), len(seated))
    if minimum_subjects < 2:
        return None
    x_parts: list[np.ndarray] = []
    y_parts: list[np.ndarray] = []
    groups: list[str] = []
    for subject, features in lying.items():
        x_parts.append(features)
        y_parts.append(np.zeros(len(features), dtype=int))
        groups.extend([f"lying:{subject}"] * len(features))
    for subject, features in seated.items():
        x_parts.append(features)
        y_parts.append(np.ones(len(features), dtype=int))
        groups.extend([f"seated:{subject}"] * len(features))
    x = np.vstack(x_parts)
    y = np.concatenate(y_parts)
    splitter = StratifiedGroupKFold(
        n_splits=min(5, minimum_subjects), shuffle=True, random_state=seed
    )
    estimator = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
    probabilities = cross_val_predict(
        estimator,
        x,
        y,
        groups=np.asarray(groups),
        cv=splitter,
        method="predict_proba",
    )[:, 1]
    return float(roc_auc_score(y, probabilities))


def _bootstrap_reduction(
    raw_lying: dict[str, np.ndarray],
    calibrated_lying: dict[str, np.ndarray],
    seated: dict[str, np.ndarray],
    bandwidths: tuple[float, ...],
    iterations: int,
    seed: int,
) -> BootstrapReductionSamples | None:
    if iterations < 2 or len(raw_lying) < 2 or len(seated) < 2:
        return None
    lying_ids = list(raw_lying)
    seated_ids = list(seated)
    rng = np.random.default_rng(seed)
    mmd2_reductions = []
    mmd_reductions = []
    for _ in range(iterations):
        sampled_lying = rng.choice(lying_ids, size=len(lying_ids), replace=True)
        sampled_seated = rng.choice(seated_ids, size=len(seated_ids), replace=True)
        raw = np.vstack([raw_lying[str(subject)] for subject in sampled_lying])
        calibrated = np.vstack(
            [calibrated_lying[str(subject)] for subject in sampled_lying]
        )
        target = np.vstack([seated[str(subject)] for subject in sampled_seated])
        raw_mmd2 = multi_kernel_mmd2(raw, target, bandwidths)
        calibrated_mmd2 = multi_kernel_mmd2(calibrated, target, bandwidths)
        mmd2_reductions.append(raw_mmd2 - calibrated_mmd2)
        mmd_reductions.append(np.sqrt(raw_mmd2) - np.sqrt(calibrated_mmd2))
    return BootstrapReductionSamples(
        mmd2=np.asarray(mmd2_reductions, dtype=float),
        mmd=np.asarray(mmd_reductions, dtype=float),
    )


def _ci95(samples: np.ndarray) -> tuple[float, float]:
    low, high = np.quantile(samples, (0.025, 0.975))
    return float(low), float(high)


def evaluate_split(
    lying: list[RecordWindows],
    seated: list[RecordWindows],
    model: TrainedCalibration,
    config: ExperimentConfig,
    seed_offset: int,
    bootstrap: bool = False,
) -> SplitMetrics:
    """Evaluate one split and return summary metrics."""
    metrics, _ = evaluate_split_with_bootstrap_samples(
        lying,
        seated,
        model,
        config,
        seed_offset,
        bootstrap=bootstrap,
    )
    return metrics


def evaluate_split_with_bootstrap_samples(
    lying: list[RecordWindows],
    seated: list[RecordWindows],
    model: TrainedCalibration,
    config: ExperimentConfig,
    seed_offset: int,
    bootstrap: bool = False,
) -> tuple[SplitMetrics, BootstrapReductionSamples | None]:
    """Evaluate raw and calibrated distributions using frozen training geometry."""
    simulated = simulate_records(
        lying, model.selected.parameters, config, seed_offset=seed_offset
    )
    raw_by_subject = {
        key: model.scaler.transform(value)
        for key, value in features_by_subject(lying).items()
    }
    calibrated_by_subject = {
        key: model.scaler.transform(value)
        for key, value in features_by_subject(simulated).items()
    }
    seated_by_subject = {
        key: model.scaler.transform(value)
        for key, value in features_by_subject(seated).items()
    }
    target = _stack(seated_by_subject)
    raw_mmd2 = multi_kernel_mmd2(_stack(raw_by_subject), target, model.bandwidths)
    calibrated_mmd2 = multi_kernel_mmd2(
        _stack(calibrated_by_subject), target, model.bandwidths
    )
    raw_mmd = float(np.sqrt(raw_mmd2))
    calibrated_mmd = float(np.sqrt(calibrated_mmd2))
    mmd2_reduction = raw_mmd2 - calibrated_mmd2
    mmd_reduction = raw_mmd - calibrated_mmd
    bootstrap_samples = None
    if bootstrap:
        bootstrap_samples = _bootstrap_reduction(
            raw_by_subject,
            calibrated_by_subject,
            seated_by_subject,
            model.bandwidths,
            config.bootstrap_iterations,
            config.seed + seed_offset,
        )
    metrics = SplitMetrics(
        raw_mmd2=raw_mmd2,
        calibrated_mmd2=calibrated_mmd2,
        mmd2_reduction=mmd2_reduction,
        relative_mmd2_reduction=(
            mmd2_reduction / raw_mmd2 if raw_mmd2 > 0 else 0.0
        ),
        raw_mmd=raw_mmd,
        calibrated_mmd=calibrated_mmd,
        mmd_reduction=mmd_reduction,
        relative_mmd_reduction=mmd_reduction / raw_mmd if raw_mmd > 0 else 0.0,
        raw_domain_auc=_domain_auc(raw_by_subject, seated_by_subject, config.seed),
        calibrated_domain_auc=_domain_auc(
            calibrated_by_subject, seated_by_subject, config.seed
        ),
        preservation_penalty=preservation_penalty(lying, simulated, config),
        achieved_artifact_rms_ratio=achieved_artifact_rms_ratio(lying, simulated),
        simulation_seed_offset=seed_offset,
        bootstrap_mmd2_reduction_ci95=(
            None if bootstrap_samples is None else _ci95(bootstrap_samples.mmd2)
        ),
        bootstrap_mmd_reduction_ci95=(
            None if bootstrap_samples is None else _ci95(bootstrap_samples.mmd)
        ),
    )
    return metrics, bootstrap_samples
