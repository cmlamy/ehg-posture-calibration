"""Nested subject-level cross-validation for calibration evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .config import ExperimentConfig
from .evaluation import (
    BootstrapReductionSamples,
    SplitMetrics,
    evaluate_split_with_bootstrap_samples,
)
from .splitting import select_split
from .training import TrainedCalibration, train_calibration
from .types import DomainSplit, RecordWindows


@dataclass(frozen=True)
class NestedFoldResult:
    fold: int
    lying_split: DomainSplit
    seated_split: DomainSplit
    model: TrainedCalibration
    test_metrics: SplitMetrics
    bootstrap_samples: BootstrapReductionSamples


@dataclass(frozen=True)
class NestedCVAggregate:
    folds: int
    raw_mmd2: float
    calibrated_mmd2: float
    mmd2_reduction: float
    relative_mmd2_reduction: float
    bootstrap_mmd2_reduction_ci95: tuple[float, float]
    raw_mmd: float
    calibrated_mmd: float
    mmd_reduction: float
    relative_mmd_reduction: float
    bootstrap_mmd_reduction_ci95: tuple[float, float]
    raw_domain_auc: float | None
    calibrated_domain_auc: float | None
    preservation_penalty: float
    achieved_artifact_rms_ratio: float


@dataclass(frozen=True)
class NestedCVResult:
    aggregate: NestedCVAggregate
    fold_results: tuple[NestedFoldResult, ...]


def subject_test_folds(
    subject_ids: list[str] | tuple[str, ...], folds: int, seed: int
) -> tuple[tuple[str, ...], ...]:
    """Partition unique subjects into reproducible, exhaustive test folds."""
    unique = np.asarray(sorted(set(subject_ids)), dtype=object)
    if folds < 2:
        raise ValueError("Nested cross-validation requires at least two outer folds")
    if len(unique) < folds:
        raise ValueError(
            f"Nested cross-validation requires at least {folds} subjects per domain"
        )
    rng = np.random.default_rng(seed)
    shuffled = unique[rng.permutation(len(unique))]
    return tuple(
        tuple(str(subject) for subject in part)
        for part in np.array_split(shuffled, folds)
    )


def _development_split(
    development_ids: tuple[str, ...],
    fractions: tuple[float, float, float],
    seed: int,
    test_ids: tuple[str, ...],
) -> DomainSplit:
    """Split one outer development set into inner training and validation sets."""
    if len(development_ids) < 2:
        raise ValueError("Each outer development set needs at least two subjects")
    train_fraction, validation_fraction, _ = fractions
    validation_share = validation_fraction / (train_fraction + validation_fraction)
    validation_count = int(round(len(development_ids) * validation_share))
    validation_count = min(max(validation_count, 1), len(development_ids) - 1)
    values = np.asarray(sorted(development_ids), dtype=object)
    rng = np.random.default_rng(seed)
    shuffled = values[rng.permutation(len(values))]
    validation = tuple(str(value) for value in shuffled[:validation_count])
    train = tuple(str(value) for value in shuffled[validation_count:])
    return DomainSplit(train=train, validation=validation, test=test_ids)


def _mean_optional(values: list[float | None], weights: np.ndarray) -> float | None:
    available = np.asarray([value is not None for value in values])
    if not np.any(available):
        return None
    numeric = np.asarray([0.0 if value is None else value for value in values])
    available_weights = weights[available]
    return float(np.average(numeric[available], weights=available_weights))


def _ci95(values: np.ndarray) -> tuple[float, float]:
    low, high = np.quantile(values, (0.025, 0.975))
    return float(low), float(high)


def _aggregate(results: list[NestedFoldResult]) -> NestedCVAggregate:
    fold_sizes = np.asarray(
        [
            len(result.lying_split.test) + len(result.seated_split.test)
            for result in results
        ],
        dtype=float,
    )
    weights = fold_sizes / fold_sizes.sum()

    def weighted(attribute: str) -> float:
        values = np.asarray(
            [getattr(result.test_metrics, attribute) for result in results],
            dtype=float,
        )
        return float(np.average(values, weights=weights))

    raw_mmd2 = weighted("raw_mmd2")
    calibrated_mmd2 = weighted("calibrated_mmd2")
    raw_mmd = weighted("raw_mmd")
    calibrated_mmd = weighted("calibrated_mmd")
    mmd2_reduction = raw_mmd2 - calibrated_mmd2
    mmd_reduction = raw_mmd - calibrated_mmd
    boot_mmd2 = np.average(
        np.vstack([result.bootstrap_samples.mmd2 for result in results]),
        axis=0,
        weights=weights,
    )
    boot_mmd = np.average(
        np.vstack([result.bootstrap_samples.mmd for result in results]),
        axis=0,
        weights=weights,
    )
    return NestedCVAggregate(
        folds=len(results),
        raw_mmd2=raw_mmd2,
        calibrated_mmd2=calibrated_mmd2,
        mmd2_reduction=mmd2_reduction,
        relative_mmd2_reduction=(
            mmd2_reduction / raw_mmd2 if raw_mmd2 > 0 else 0.0
        ),
        bootstrap_mmd2_reduction_ci95=_ci95(boot_mmd2),
        raw_mmd=raw_mmd,
        calibrated_mmd=calibrated_mmd,
        mmd_reduction=mmd_reduction,
        relative_mmd_reduction=mmd_reduction / raw_mmd if raw_mmd > 0 else 0.0,
        bootstrap_mmd_reduction_ci95=_ci95(boot_mmd),
        raw_domain_auc=_mean_optional(
            [result.test_metrics.raw_domain_auc for result in results], weights
        ),
        calibrated_domain_auc=_mean_optional(
            [result.test_metrics.calibrated_domain_auc for result in results], weights
        ),
        preservation_penalty=weighted("preservation_penalty"),
        achieved_artifact_rms_ratio=weighted("achieved_artifact_rms_ratio"),
    )


def run_nested_cv(
    lying: list[RecordWindows],
    seated: list[RecordWindows],
    config: ExperimentConfig,
    folds: int = 5,
    progress: Callable[[str], None] | None = None,
) -> NestedCVResult:
    """Fit and evaluate one independently selected model per outer fold."""
    progress = progress or (lambda _: None)
    lying_folds = subject_test_folds(
        [record.subject_id for record in lying], folds, config.seed
    )
    seated_folds = subject_test_folds(
        [record.subject_id for record in seated], folds, config.seed + 1
    )
    all_lying = set().union(*(set(fold) for fold in lying_folds))
    all_seated = set().union(*(set(fold) for fold in seated_folds))
    results: list[NestedFoldResult] = []

    for fold_index, (lying_test, seated_test) in enumerate(
        zip(lying_folds, seated_folds, strict=True), start=1
    ):
        progress(f"outer fold {fold_index}/{folds}: preparing inner split")
        lying_development = tuple(sorted(all_lying - set(lying_test)))
        seated_development = tuple(sorted(all_seated - set(seated_test)))
        lying_split = _development_split(
            lying_development,
            config.split_fractions,
            config.seed + 10_000 + fold_index,
            lying_test,
        )
        seated_split = _development_split(
            seated_development,
            config.split_fractions,
            config.seed + 20_000 + fold_index,
            seated_test,
        )
        model = train_calibration(
            select_split(lying, lying_split, "train"),
            select_split(seated, seated_split, "train"),
            select_split(lying, lying_split, "validation"),
            select_split(seated, seated_split, "validation"),
            config,
            progress=lambda message, index=fold_index: progress(
                f"outer fold {index}/{folds}: {message}"
            ),
        )
        metrics, bootstrap_samples = evaluate_split_with_bootstrap_samples(
            select_split(lying, lying_split, "test"),
            select_split(seated, seated_split, "test"),
            model,
            config,
            seed_offset=80_000 + fold_index * 10_000,
            bootstrap=True,
        )
        if bootstrap_samples is None:
            raise RuntimeError("Nested cross-validation requires bootstrap samples")
        results.append(
            NestedFoldResult(
                fold=fold_index,
                lying_split=lying_split,
                seated_split=seated_split,
                model=model,
                test_metrics=metrics,
                bootstrap_samples=bootstrap_samples,
            )
        )
        progress(
            f"outer fold {fold_index}/{folds}: test MMD² reduction="
            f"{metrics.mmd2_reduction:.6f}"
        )

    return NestedCVResult(
        aggregate=_aggregate(results),
        fold_results=tuple(results),
    )
