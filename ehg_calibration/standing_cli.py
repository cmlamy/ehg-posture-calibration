"""Command-line entry point for unvalidated standing sensitivity projections."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import numpy as np

from .config import load_effective_config
from .data import PROFILE_SELECTORS, load_wfdb_directory
from .preprocessing import (
    balance_subject_counts,
    cap_windows_by_subject,
    preprocess_records,
)
from .simulator import SimulationParameters
from .standing import (
    SCENARIOS,
    combine_nested_projection_results,
    load_standing_config,
    run_standing_projection,
)
from .standing_events import estimate_event_statistics


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Project unvalidated standing EHG sensitivity scenarios from a fixed "
            "lying-to-target calibration"
        )
    )
    parser.add_argument("--calibration-results", type=Path, required=True)
    parser.add_argument("--calibration-fold", type=int)
    parser.add_argument("--lying-dir", type=Path, required=True)
    parser.add_argument("--seated-dir", type=Path, required=True)
    parser.add_argument("--lying-profile", choices=PROFILE_SELECTORS, default="tpehgt")
    parser.add_argument(
        "--additional-lying-dir", action="append", type=Path, default=[]
    )
    parser.add_argument(
        "--additional-lying-profile",
        action="append",
        choices=PROFILE_SELECTORS,
        default=[],
    )
    parser.add_argument("--seated-profile", choices=PROFILE_SELECTORS, default="icelandic")
    parser.add_argument("--lying-subject-map", type=Path)
    parser.add_argument("--seated-subject-map", type=Path)
    parser.add_argument(
        "--standing-config",
        type=Path,
        default=Path("configs/standing_projection.json"),
    )
    parser.add_argument("--scenario", choices=SCENARIOS, default="standing_still")
    parser.add_argument("--draws", type=int)
    parser.add_argument(
        "--quick", action="store_true", help="Run 25 draws for a smoke test"
    )
    parser.add_argument("--output-dir", type=Path, default=Path("results/standing"))
    return parser


def _read_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def _calibration_selections(
    results_dir: Path, fold_number: int | None
) -> list[
    tuple[int | None, SimulationParameters, dict[str, Any], dict[str, Any], int]
]:
    model = _read_json(results_dir / "model.json")
    splits = _read_json(results_dir / "splits.json")
    if model.get("mode") == "nested_cross_validation":
        available = sorted(int(fold["fold"]) for fold in model["folds"])
        requested = available if fold_number is None else [fold_number]
        selections = []
        for requested_fold in requested:
            try:
                selected_model = next(
                    fold
                    for fold in model["folds"]
                    if int(fold["fold"]) == requested_fold
                )
                selected_split = next(
                    fold
                    for fold in splits["folds"]
                    if int(fold["fold"]) == requested_fold
                )
            except StopIteration as exc:
                raise ValueError(
                    f"Calibration fold {requested_fold} does not exist"
                ) from exc
            parameters = selected_model["selected_candidate"]["parameters"]
            selections.append(
                (
                    requested_fold,
                    SimulationParameters(**parameters),
                    selected_split["lying"],
                    selected_split["seated"],
                    80_000 + requested_fold * 10_000,
                )
            )
        return selections
    if fold_number is not None:
        raise ValueError("--calibration-fold is only valid for nested calibration results")
    parameters = model["selected_parameters"]
    offset = int(
        model.get("seeds", {})
        .get("evaluation_simulation_offsets", {})
        .get("test", 80_000)
    )
    return [
        (
            None,
            SimulationParameters(**parameters),
            splits["lying"],
            splits["seated"],
            offset,
        )
    ]


def _report(summary: dict[str, Any]) -> str:
    metric_lines = []
    for name, interval in summary["metrics"].items():
        metric_lines.append(
            f"- `{name}`: median {interval['median']:.6f}, projected 95% "
            f"interval [{interval['p2_5']:.6f}, {interval['p97_5']:.6f}]"
        )
    driver_lines = []
    for metric, drivers in summary["drivers_spearman_rho"].items():
        available = [(name, value) for name, value in drivers.items() if value is not None]
        if available:
            name, rho = max(available, key=lambda item: abs(item[1]))
            driver_lines.append(f"- `{metric}`: `{name}` (Spearman rho {rho:.3f})")
    if "event_statistics_by_fold" in summary:
        event_sections = []
        for fold, event in summary["event_statistics_by_fold"].items():
            event_sections.append(
                f"### Calibration fold {fold}\n\n"
                f"- Quiet detected-event rate: "
                f"{event['quiet_event_rate_per_hour']:.3f}/hour\n"
                "- Movement-associated detected-event rate: "
                f"{event['movement_associated_event_rate_per_hour']:.3f}/hour\n"
                "- Movement/quiet detected-rate enrichment: "
                f"{event['movement_to_quiet_rate_ratio']:.3f}x\n"
                f"- Detected events: {event['detected_event_count']}\n"
                "- Position-associated detected events: "
                f"{event['position_change_associated_detected_event_count']}\n"
                f"- Transition morphology source: "
                f"`{event['transition_morphology_source']}`\n"
            )
        event_text = "\n".join(event_sections)
    else:
        event = summary["event_statistics"]
        event_text = (
            f"- Quiet detected-event rate: {event['quiet_event_rate_per_hour']:.3f}/hour\n"
            "- Movement-associated detected-event rate: "
            f"{event['movement_associated_event_rate_per_hour']:.3f}/hour\n"
            "- Movement/quiet detected-rate enrichment: "
            f"{event['movement_to_quiet_rate_ratio']:.3f}x\n"
            f"- Detected events: {event['detected_event_count']}\n"
            "- Position-associated detected events: "
            f"{event['position_change_associated_detected_event_count']}\n"
            f"- Transition morphology source: "
            f"`{event['transition_morphology_source']}`\n"
            f"- Rate fallback used: {event['rate_fallback_used']}\n"
            f"- Morphology fallback used: {event['morphology_fallback_used']}\n"
        )
    return (
        "# EHG standing projection sensitivity report\n\n"
        "> Status: **projected, not validated**. No measured standing pregnancy EHG "
        "was used. Intervals describe simulations conditional on the stated assumptions; "
        "they are not clinical confidence intervals.\n\n"
        f"Scenario: `{summary['scenario']}`  \n"
        f"Simulation draws: {summary['n_simulation_draws']}  \n"
        f"Held-out source subjects: {summary['source_subject_count']}  \n"
        f"Source windows per draw: {summary['source_window_count_per_draw']}\n\n"
        "## Projected outcomes\n\n"
        + "\n".join(metric_lines)
        + "\n\n## Strongest simulator sensitivity driver per outcome\n\n"
        + ("\n".join(driver_lines) if driver_lines else "No estimable correlations.")
        + "\n\n## Training-only target event evidence\n\n"
        + event_text
        + "\n"
        "These observations come only from target training women. Translating them into "
        "standing scenarios is a hypothesis, not a standing measurement.\n\n"
        "## Contraction detector AUC\n\n"
        f"Unavailable: {summary['contraction_detector_auc']['reason']}\n\n"
        "The demo envelope band is pointwise: at each time point it contains the central "
        "95% of simulated values. It is not a simultaneous confidence band.\n"
    )


def _save_demo_plot(path: Path, demo: dict[str, np.ndarray]) -> None:
    matplotlib_cache = Path("/tmp/ehg-posture-calibration-matplotlib")
    matplotlib_cache.mkdir(exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(matplotlib_cache))
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fs = float(demo["fs"])
    time = np.arange(len(demo["target_calibrated_envelope"])) / fs
    figure, axis = plt.subplots(figsize=(10, 4.5))
    axis.plot(
        time,
        demo["target_calibrated_envelope"],
        label="Fixed target-domain-calibrated envelope",
    )
    axis.plot(
        time,
        demo["standing_envelope_median"],
        label="Projected standing median",
    )
    axis.fill_between(
        time,
        demo["standing_envelope_lower"],
        demo["standing_envelope_upper"],
        alpha=0.25,
        label="95% pointwise simulation band",
    )
    axis.set_xlabel("Time (seconds)")
    axis.set_ylabel("Contraction-envelope amplitude")
    axis.set_title("Projected standing envelope — median and 95% pointwise simulation band")
    axis.legend(loc="best")
    figure.tight_layout()
    figure.savefig(path, dpi=160)
    plt.close(figure)


def run(args: argparse.Namespace) -> Path:
    results_dir = args.calibration_results
    calibration_config = load_effective_config(results_dir / "effective_config.json")
    standing_config = load_standing_config(args.standing_config)
    draws = 25 if args.quick else (args.draws or int(standing_config["default_draws"]))
    if draws < 1:
        raise ValueError("--draws must be positive")
    selections = _calibration_selections(results_dir, args.calibration_fold)
    if len(args.additional_lying_dir) != len(args.additional_lying_profile):
        raise ValueError(
            "Each --additional-lying-dir requires one --additional-lying-profile"
        )

    print("Loading the calibration datasets...")
    lying_raw = load_wfdb_directory(
        args.lying_dir, args.lying_profile, args.lying_subject_map
    )
    for directory, profile in zip(
        args.additional_lying_dir, args.additional_lying_profile, strict=True
    ):
        lying_raw.extend(load_wfdb_directory(directory, profile))
    lying_raw = [
        record
        for record in lying_raw
        if record.metadata.get("rectype", "").strip().lower() != "non-pregnant"
    ]
    seated_raw = load_wfdb_directory(
        args.seated_dir, args.seated_profile, args.seated_subject_map
    )
    seated_raw = [
        record
        for record in seated_raw
        if record.metadata.get("record_type", "").strip().lower() != "labour"
    ]
    lying_raw, seated_raw = balance_subject_counts(
        lying_raw,
        seated_raw,
        calibration_config.max_subjects_per_domain,
        calibration_config.seed,
    )

    print("Preprocessing the fixed held-out source cohort(s)...")
    lying = cap_windows_by_subject(
        preprocess_records(lying_raw, calibration_config),
        calibration_config.max_windows_per_subject,
        calibration_config.seed,
    )
    projection_results = []
    calibration_metadata = []
    leakage_metadata = []
    event_statistics_by_fold = {}
    for selection_index, (
        fold,
        parameters,
        lying_split,
        seated_split,
        calibration_seed_offset,
    ) in enumerate(selections):
        label = "single split" if fold is None else f"fold {fold}"
        print(
            f"Estimating electrode-event evidence from {label} target training "
            "women only..."
        )
        event_statistics = estimate_event_statistics(
            seated_raw,
            set(seated_split["train"]),
            args.seated_dir,
            calibration_config,
            standing_config,
        )
        held_out_ids = set(lying_split["test"])
        source_records = [
            record for record in lying if record.subject_id in held_out_ids
        ]
        if {record.subject_id for record in source_records} != held_out_ids:
            missing = sorted(
                held_out_ids - {record.subject_id for record in source_records}
            )
            raise ValueError(f"Could not reproduce held-out source subjects: {missing}")
        print(
            f"Generating {draws} projected {args.scenario} realizations for {label}..."
        )
        fold_result = run_standing_projection(
            source_records,
            parameters,
            calibration_config,
            standing_config,
            event_statistics,
            args.scenario,
            draws,
            calibration_seed_offset,
            projection_seed_offset=selection_index * 1_000_000,
        )
        projection_results.append((fold, fold_result))
        calibration_metadata.append(
            {
                "fold": fold,
                "fixed_parameters": parameters.as_dict(),
                "simulation_seed_offset": calibration_seed_offset,
                "held_out_source_subject_ids": sorted(held_out_ids),
            }
        )
        leakage_metadata.append(
            {
                "fold": fold,
                "event_statistics_subject_ids": sorted(seated_split["train"]),
                "target_validation_subjects_excluded": sorted(
                    seated_split["validation"]
                ),
                "target_test_subjects_excluded": sorted(seated_split["test"]),
            }
        )
        event_statistics_by_fold[str(fold or 1)] = event_statistics

    if len(projection_results) == 1:
        _, result = projection_results[0]
        result.summary["event_statistics"] = next(
            iter(event_statistics_by_fold.values())
        )
    else:
        nested_results = [
            (int(fold), result)
            for fold, result in projection_results
            if fold is not None
        ]
        result = combine_nested_projection_results(nested_results)
        result.summary["event_statistics_by_fold"] = event_statistics_by_fold
    result.summary["calibration"] = {
        "results_directory": str(results_dir),
        "requested_calibration_fold": args.calibration_fold,
        "models": calibration_metadata,
    }
    result.summary["data_leakage_control"] = leakage_metadata

    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    _write_json(output / "standing_projection.json", result.summary)
    _write_json(
        output / "standing_effective_config.json",
        {
            "standing": standing_config,
            "calibration_effective_config": _read_json(
                results_dir / "effective_config.json"
            ),
        },
    )
    with (output / "standing_samples.jsonl").open("w", encoding="utf-8") as handle:
        for sample in result.samples:
            handle.write(json.dumps(sample, sort_keys=True) + "\n")
    np.savez_compressed(output / "standing_demo.npz", **result.demo)
    _save_demo_plot(output / "standing_demo_envelope.png", result.demo)
    (output / "report.md").write_text(_report(result.summary), encoding="utf-8")
    print(f"Standing projection written to {output}")
    return output


def main() -> None:
    run(_parser().parse_args())


if __name__ == "__main__":
    main()
