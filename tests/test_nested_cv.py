from argparse import Namespace
from dataclasses import replace
import json

import numpy as np

from conftest import make_records
from ehg_calibration.cli import _nested_cv_outputs
from ehg_calibration.nested_cv import run_nested_cv, subject_test_folds
from ehg_calibration.splitting import assert_disjoint


def test_subject_test_folds_are_reproducible_exhaustive_and_disjoint():
    subjects = [f"s{index}" for index in range(13)]
    first = subject_test_folds(subjects, folds=5, seed=42)
    second = subject_test_folds(subjects, folds=5, seed=42)
    assert first == second
    assert sorted(subject for fold in first for subject in fold) == sorted(subjects)
    assert sum(len(fold) for fold in first) == len(
        set(subject for fold in first for subject in fold)
    )
    assert max(map(len, first)) - min(map(len, first)) <= 1


def test_nested_cv_uses_each_subject_once_for_outer_testing(config, tmp_path):
    lying = make_records("lying", subjects=10, windows_per_subject=1, seed=31)
    seated = make_records("seated", subjects=10, windows_per_subject=1, seed=32)
    fast = replace(config, bootstrap_iterations=5)

    result = run_nested_cv(lying, seated, fast, folds=5)

    lying_test_ids = []
    seated_test_ids = []
    for fold in result.fold_results:
        assert_disjoint(fold.lying_split)
        assert_disjoint(fold.seated_split)
        lying_test_ids.extend(fold.lying_split.test)
        seated_test_ids.extend(fold.seated_split.test)
        assert fold.bootstrap_samples.mmd2.shape == (5,)
        assert fold.bootstrap_samples.mmd.shape == (5,)

    assert sorted(lying_test_ids) == sorted(record.subject_id for record in lying)
    assert sorted(seated_test_ids) == sorted(record.subject_id for record in seated)
    assert len(lying_test_ids) == len(set(lying_test_ids))
    assert len(seated_test_ids) == len(set(seated_test_ids))
    assert result.aggregate.folds == 5
    assert np.isfinite(result.aggregate.mmd2_reduction)
    assert np.isfinite(result.aggregate.mmd_reduction)
    assert len(result.aggregate.bootstrap_mmd2_reduction_ci95) == 2
    assert len(result.aggregate.bootstrap_mmd_reduction_ci95) == 2

    output = _nested_cv_outputs(
        result,
        fast,
        Namespace(output_dir=tmp_path, seated_profile="icelandic"),
    )
    metrics = json.loads((output / "metrics.json").read_text(encoding="utf-8"))
    models = json.loads((output / "model.json").read_text(encoding="utf-8"))
    splits = json.loads((output / "splits.json").read_text(encoding="utf-8"))
    assert metrics["mode"] == "nested_cross_validation"
    assert len(metrics["folds"]) == 5
    assert len(models["folds"]) == 5
    assert len(splits["folds"]) == 5
    assert "MMD²" in (output / "report.md").read_text(encoding="utf-8")
