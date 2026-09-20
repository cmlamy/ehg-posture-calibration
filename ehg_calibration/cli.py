"""Command-line entry point for a complete calibration experiment."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, replace
from pathlib import Path
from typing import Any

import numpy as np

from .config import ExperimentConfig, load_config
from .data import PROFILE_SELECTORS, load_wfdb_directory
from .evaluation import evaluate_split
from .features import FEATURE_NAMES
from .nested_cv import NestedCVResult, run_nested_cv as fit_nested_cv
from .preprocessing import (
    balance_subject_counts,
    cap_windows_by_subject,
    preprocess_records,
)
from .splitting import assert_disjoint, select_split, split_subjects
from .training import train_calibration


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train and test unpaired lying-to-seated EHG calibration"
    )
    parser.add_argument("--lying-dir", type=Path, required=True)
    parser.add_argument("--seated-dir", type=Path, required=True)
    parser.add_argument("--lying-profile", choices=PROFILE_SELECTORS, default="tpehgt")
    parser.add_argument(
        "--additional-lying-dir",
        action="append",
        type=Path,
        default=[],
        help="Additional lying-domain WFDB directory; may be repeated",
    )
    parser.add_argument(
        "--additional-lying-profile",
        action="append",
        choices=PROFILE_SELECTORS,
        default=[],
        help="Profile for each --additional-lying-dir, in the same order",
    )
    parser.add_argument("--seated-profile", choices=PROFILE_SELECTORS, default="icelandic")
    parser.add_argument("--lying-subject-map", type=Path)
    parser.add_argument("--seated-subject-map", type=Path)
    parser.add_argument(
        "--include-target-labour",
        action="store_true",
        help="Include Icelandic records marked as labour (excluded by default)",
    )
    parser.add_argument("--config", type=Path, default=Path("configs/default.json"))
    parser.add_argument(
        "--physiology-profile",
        help="Named physiology profile from the configuration (default: active_profile)",
    )
    parser.add_argument(
        "--respiratory-amplitude-mode",
        choices=("legacy_rms_cap", "paper_sd_quarter_extrapolation"),
        help="Optional respiratory amplitude model override",
    )
    parser.add_argument("--output-dir", type=Path, default=Path("results/latest"))
    parser.add_argument(
        "--include-nonpregnant",
        action="store_true",
        help="Include TPEHGT non-pregnant records in the lying domain",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Use one short optimizer restart and 50 bootstrap iterations",
    )
    parser.add_argument(
        "--nested-cv-folds",
        type=int,
        metavar="N",
        help=(
            "Run nested subject-level cross-validation with N outer folds instead "
            "of one train/validation/test split (recommended: 5)"
        ),
    )
    return parser


def _quick_config(config: ExperimentConfig) -> ExperimentConfig:
    return replace(
        config,
        optimization=replace(
            config.optimization,
            restarts=1,
            population_size=4,
            max_iterations=3,
        ),
        max_windows_per_subject=min(6, config.max_windows_per_subject),
        bootstrap_iterations=50,
    )


def _json_dump(path: Path, value: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")


def _filter_nonpregnant(records: list, include: bool) -> list:
    if include:
        return records
    return [
        record
        for record in records
        if record.metadata.get("rectype", "").strip().lower() != "non-pregnant"
    ]


def _filter_target_labour(records: list, include: bool) -> list:
    if include:
        return records
    return [
        record
        for record in records
        if record.metadata.get("record_type", "").strip().lower() != "labour"
    ]


def _metrics_dict(metrics: Any) -> dict[str, Any]:
    result = asdict(metrics)
    for key in (
        "bootstrap_mmd2_reduction_ci95",
        "bootstrap_mmd_reduction_ci95",
    ):
        if result[key] is not None:
            result[key] = list(result[key])
    return result


def _candidate_dict(candidate: Any) -> dict[str, Any]:
    return {
        **{
            key: value
            for key, value in asdict(candidate).items()
            if key != "parameters"
        },
        "training_mmd": candidate.training_mmd,
        "validation_mmd": candidate.validation_mmd,
        "parameters": candidate.parameters.as_dict(),
    }


def _nested_cv_outputs(
    result: NestedCVResult,
    config: ExperimentConfig,
    args: argparse.Namespace,
) -> Path:
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    _json_dump(
        output / "splits.json",
        {
            "mode": "nested_cross_validation",
            "outer_folds": len(result.fold_results),
            "folds": [
                {
                    "fold": fold.fold,
                    "lying": asdict(fold.lying_split),
                    "seated": asdict(fold.seated_split),
                }
                for fold in result.fold_results
            ],
        },
    )
    _json_dump(
        output / "model.json",
        {
            "mode": "nested_cross_validation",
            "note": "Each outer fold has its own independently selected model.",
            "feature_names": FEATURE_NAMES,
            "folds": [
                {
                    "fold": fold.fold,
                    "selected_candidate": _candidate_dict(fold.model.selected),
                    "candidates": [
                        _candidate_dict(candidate) for candidate in fold.model.candidates
                    ],
                    "bandwidths": fold.model.bandwidths,
                    "feature_scaler": {
                        "mean": fold.model.scaler.mean_.tolist(),
                        "scale": fold.model.scaler.scale_.tolist(),
                        "variance": fold.model.scaler.var_.tolist(),
                    },
                }
                for fold in result.fold_results
            ],
        },
    )
    aggregate = asdict(result.aggregate)
    for key in (
        "bootstrap_mmd2_reduction_ci95",
        "bootstrap_mmd_reduction_ci95",
    ):
        aggregate[key] = list(aggregate[key])
    _json_dump(
        output / "metrics.json",
        {
            "mode": "nested_cross_validation",
            "aggregate": aggregate,
            "folds": [
                {
                    "fold": fold.fold,
                    **_metrics_dict(fold.test_metrics),
                }
                for fold in result.fold_results
            ],
        },
    )
    _json_dump(output / "effective_config.json", asdict(config))

    selected = np.vstack(
        [fold.model.selected.parameters.as_array() for fold in result.fold_results]
    )
    parameter_lines = "\n".join(
        f"- {name}: mean {selected[:, index].mean():.4f}, "
        f"SD {selected[:, index].std(ddof=1):.4f}, "
        f"range [{selected[:, index].min():.4f}, {selected[:, index].max():.4f}]"
        for index, name in enumerate(result.fold_results[0].model.selected.parameters.as_dict())
    )
    fold_lines = "\n".join(
        f"- Fold {fold.fold}: MMD² {fold.test_metrics.raw_mmd2:.6f} -> "
        f"{fold.test_metrics.calibrated_mmd2:.6f}; reduction "
        f"{fold.test_metrics.mmd2_reduction:.6f}"
        for fold in result.fold_results
    )
    aggregate_metrics = result.aggregate
    domain_note = ""
    if args.seated_profile == "icelandic":
        domain_note = (
            "\n> EHGDB is not posture-controlled seated ground truth. These results "
            "measure calibration to the Icelandic recording domain, not specifically "
            "to seated posture.\n"
        )
    report = (
        "# Nested subject-level cross-validation report\n\n"
        f"{domain_note}\n"
        f"Outer folds: {aggregate_metrics.folds}. Every subject appears in exactly "
        "one outer test fold, and each fold selects its model using only that fold's "
        "inner training and validation subjects.\n\n"
        "## Aggregate held-out performance\n\n"
        f"- Raw MMD²: {aggregate_metrics.raw_mmd2:.6f}\n"
        f"- Calibrated MMD²: {aggregate_metrics.calibrated_mmd2:.6f}\n"
        f"- MMD² reduction: {aggregate_metrics.mmd2_reduction:.6f} "
        f"({aggregate_metrics.relative_mmd2_reduction:.1%})\n"
        "- Subject-bootstrap 95% CI for MMD² reduction: "
        f"[{aggregate_metrics.bootstrap_mmd2_reduction_ci95[0]:.6f}, "
        f"{aggregate_metrics.bootstrap_mmd2_reduction_ci95[1]:.6f}]\n"
        f"- Raw MMD: {aggregate_metrics.raw_mmd:.6f}\n"
        f"- Calibrated MMD: {aggregate_metrics.calibrated_mmd:.6f}\n"
        f"- MMD reduction: {aggregate_metrics.mmd_reduction:.6f} "
        f"({aggregate_metrics.relative_mmd_reduction:.1%})\n"
        "- Subject-bootstrap 95% CI for MMD reduction: "
        f"[{aggregate_metrics.bootstrap_mmd_reduction_ci95[0]:.6f}, "
        f"{aggregate_metrics.bootstrap_mmd_reduction_ci95[1]:.6f}]\n"
        f"- Mean raw domain AUC: {aggregate_metrics.raw_domain_auc}\n"
        f"- Mean calibrated domain AUC: {aggregate_metrics.calibrated_domain_auc}\n"
        f"- Mean preservation penalty: {aggregate_metrics.preservation_penalty:.6f}\n"
        "- Mean achieved artifact/source RMS ratio: "
        f"{aggregate_metrics.achieved_artifact_rms_ratio:.6f}\n\n"
        "## Outer-fold results\n\n"
        f"{fold_lines}\n\n"
        "## Selected-parameter stability\n\n"
        f"{parameter_lines}\n\n"
        "The aggregate is a cross-validated generalization estimate, not the result "
        "of one final fitted model. A confidence interval crossing zero does not "
        "establish a reliable average reduction. Do not tune settings against these "
        "outer-test results and continue to call them untouched.\n"
    )
    (output / "report.md").write_text(report, encoding="utf-8")
    print(f"Nested cross-validation results written to {output}")
    print(
        f"Aggregate outer-test MMD²: {aggregate_metrics.raw_mmd2:.6f} -> "
        f"{aggregate_metrics.calibrated_mmd2:.6f}; MMD: "
        f"{aggregate_metrics.raw_mmd:.6f} -> {aggregate_metrics.calibrated_mmd:.6f}"
    )
    return output


def run(args: argparse.Namespace) -> Path:
    config = load_config(args.config, profile=args.physiology_profile)
    if args.respiratory_amplitude_mode:
        config = replace(
            config,
            physiology=replace(
                config.physiology,
                respiratory_amplitude_mode=args.respiratory_amplitude_mode,
            ),
        )
    if args.quick:
        config = _quick_config(config)

    print("Loading WFDB records...")
    if len(args.additional_lying_dir) != len(args.additional_lying_profile):
        raise ValueError(
            "Each --additional-lying-dir requires one --additional-lying-profile"
        )
    lying_raw = load_wfdb_directory(
        args.lying_dir, args.lying_profile, args.lying_subject_map
    )
    for directory, profile in zip(
        args.additional_lying_dir, args.additional_lying_profile, strict=True
    ):
        lying_raw.extend(load_wfdb_directory(directory, profile))
    lying_raw = _filter_nonpregnant(lying_raw, args.include_nonpregnant)
    seated_raw = load_wfdb_directory(
        args.seated_dir, args.seated_profile, args.seated_subject_map
    )
    seated_raw = _filter_target_labour(seated_raw, args.include_target_labour)
    all_lying_records = len(lying_raw)
    lying_raw, seated_raw = balance_subject_counts(
        lying_raw,
        seated_raw,
        config.max_subjects_per_domain,
        config.seed,
    )
    print(
        f"  available lying records: {all_lying_records}; "
        f"balanced experiment records: {len(lying_raw)} lying / {len(seated_raw)} target"
    )

    print("Preprocessing records...")
    lying = cap_windows_by_subject(
        preprocess_records(lying_raw, config),
        config.max_windows_per_subject,
        config.seed,
    )
    seated = cap_windows_by_subject(
        preprocess_records(seated_raw, config),
        config.max_windows_per_subject,
        config.seed + 1,
    )

    if args.nested_cv_folds is not None:
        if args.nested_cv_folds < 2:
            raise ValueError("--nested-cv-folds must be at least 2")
        print(
            f"Running {args.nested_cv_folds}-fold nested subject-level "
            "cross-validation..."
        )
        result = fit_nested_cv(
            lying,
            seated,
            config,
            folds=args.nested_cv_folds,
            progress=lambda message: print(f"  {message}"),
        )
        return _nested_cv_outputs(result, config, args)

    lying_split = split_subjects(
        [record.subject_id for record in lying], config.split_fractions, config.seed
    )
    seated_split = split_subjects(
        [record.subject_id for record in seated], config.split_fractions, config.seed + 1
    )
    assert_disjoint(lying_split)
    assert_disjoint(seated_split)

    lying_sets = {
        name: select_split(lying, lying_split, name)
        for name in ("train", "validation", "test")
    }
    seated_sets = {
        name: select_split(seated, seated_split, name)
        for name in ("train", "validation", "test")
    }

    print("Training candidate calibrations...")
    model = train_calibration(
        lying_sets["train"],
        seated_sets["train"],
        lying_sets["validation"],
        seated_sets["validation"],
        config,
        progress=lambda message: print(f"  {message}"),
    )
    print(f"Selected parameters: {model.selected.parameters.as_dict()}")

    print("Evaluating frozen model...")
    metrics = {
        "train": evaluate_split(
            lying_sets["train"], seated_sets["train"], model, config, 60_000
        ),
        "validation": evaluate_split(
            lying_sets["validation"], seated_sets["validation"], model, config, 70_000
        ),
        "test": evaluate_split(
            lying_sets["test"],
            seated_sets["test"],
            model,
            config,
            80_000,
            bootstrap=True,
        ),
    }

    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    _json_dump(
        output / "splits.json",
        {"lying": asdict(lying_split), "seated": asdict(seated_split)},
    )
    _json_dump(
        output / "model.json",
        {
            "selected_parameters": model.selected.parameters.as_dict(),
            "selected_candidate": _candidate_dict(model.selected),
            "bandwidths": model.bandwidths,
            "feature_names": FEATURE_NAMES,
            "feature_scaler": {
                "mean": model.scaler.mean_.tolist(),
                "scale": model.scaler.scale_.tolist(),
                "variance": model.scaler.var_.tolist(),
            },
            "parameter_ranges": config.parameter_ranges,
            "physiology": asdict(config.physiology),
            "profile": {
                "name": config.profile_name,
                "version": config.profile_version,
                "schema_version": config.schema_version,
                "evidence_status": config.physiology.evidence_status,
            },
            "seeds": {
                "config_seed": config.seed,
                "train_simulation_offsets": [
                    10_000 * (i + 1)
                    for i in range(config.optimization.restarts)
                ],
                "validation_simulation_offset": 50_000,
                "evaluation_simulation_offsets": {
                    "train": 60_000,
                    "validation": 70_000,
                    "test": 80_000,
                },
            },
            "input_profiles": {
                "lying": args.lying_profile,
                "additional_lying": args.additional_lying_profile,
                "seated": args.seated_profile,
            },
            "candidates": [_candidate_dict(candidate) for candidate in model.candidates],
        },
    )
    _json_dump(output / "effective_config.json", asdict(config))
    metric_payload = {name: _metrics_dict(value) for name, value in metrics.items()}
    _json_dump(output / "metrics.json", metric_payload)
    test = metrics["test"]
    mmd2_interval = test.bootstrap_mmd2_reduction_ci95
    mmd_interval = test.bootstrap_mmd_reduction_ci95
    mmd2_interval_text = (
        "not available"
        if mmd2_interval is None
        else f"[{mmd2_interval[0]:.6f}, {mmd2_interval[1]:.6f}]"
    )
    mmd_interval_text = (
        "not available"
        if mmd_interval is None
        else f"[{mmd_interval[0]:.6f}, {mmd_interval[1]:.6f}]"
    )
    domain_note = ""
    if args.seated_profile == "icelandic":
        domain_note = (
            "\n> EHGDB is not posture-controlled seated ground truth. Its documentation "
            "allows position changes, so these results establish calibration to the "
            "Icelandic recording domain, not specifically to seated posture.\n"
        )
    report = (
        "# Lying-to-seated calibration report\n\n"
        f"{domain_note}\n"
        f"Selected parameters: `{model.selected.parameters.as_dict()}`\n\n"
        "## Untouched test subjects\n\n"
        f"- Raw MMD²: {test.raw_mmd2:.6f}\n"
        f"- Calibrated MMD²: {test.calibrated_mmd2:.6f}\n"
        f"- MMD² reduction: {test.mmd2_reduction:.6f} "
        f"({test.relative_mmd2_reduction:.1%})\n"
        f"- Subject-bootstrap 95% CI for MMD² reduction: {mmd2_interval_text}\n"
        f"- Raw MMD: {test.raw_mmd:.6f}\n"
        f"- Calibrated MMD: {test.calibrated_mmd:.6f}\n"
        f"- MMD reduction: {test.mmd_reduction:.6f} "
        f"({test.relative_mmd_reduction:.1%})\n"
        f"- Subject-bootstrap 95% CI for MMD reduction: {mmd_interval_text}\n"
        f"- Raw domain AUC: {test.raw_domain_auc}\n"
        f"- Calibrated domain AUC: {test.calibrated_domain_auc}\n"
        f"- Preservation penalty: {test.preservation_penalty:.6f}\n\n"
        f"- Achieved artifact/source RMS ratio: {test.achieved_artifact_rms_ratio:.6f}\n"
        f"- Evaluation simulation seed offset: {test.simulation_seed_offset}\n\n"
        "## Evidence and interpretation\n\n"
        f"- Physiology profile: `{config.profile_name}` (version {config.profile_version})\n"
        f"- Evidence status: `{config.physiology.evidence_status}`\n\n"
        "MMD is the square root of MMD²; optimization minimizes MMD². A positive "
        "reduction on either scale indicates improvement. If its bootstrap interval "
        "crosses zero, this run does not establish a reliable held-out reduction. "
        "The preservation penalty and artifact RMS ratio are diagnostics, not "
        "guarantees of physiological preservation. Lower MMD is not proof of "
        "physiological correctness or standing validity.\n"
    )
    (output / "report.md").write_text(report, encoding="utf-8")
    print(f"Results written to {output}")
    print(
        f"Untouched test MMD²: {test.raw_mmd2:.6f} -> "
        f"{test.calibrated_mmd2:.6f} ({test.relative_mmd2_reduction:.1%} reduction); "
        f"MMD: {test.raw_mmd:.6f} -> {test.calibrated_mmd:.6f} "
        f"({test.relative_mmd_reduction:.1%} reduction)"
    )
    return output


def main() -> None:
    run(_parser().parse_args())


if __name__ == "__main__":
    main()
