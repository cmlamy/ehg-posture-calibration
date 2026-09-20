from dataclasses import replace

import numpy as np

from conftest import make_records
from ehg_calibration.evaluation import evaluate_split
from ehg_calibration.simulator import SimulationParameters, simulate_records
from ehg_calibration.splitting import select_split, split_subjects
from ehg_calibration.training import train_calibration
from ehg_calibration.training import fit_training_geometry, flatten_features, score_parameters


def test_end_to_end_training_and_held_out_evaluation(config):
    lying = make_records("lying", subjects=9, windows_per_subject=2, seed=11)
    true_parameters = SimulationParameters(0.55, 0.35, 0.3, 0.25, 0.2)
    seated_base = make_records("seated", subjects=9, windows_per_subject=2, seed=11)
    # Give paired synthetic sources different IDs; the algorithm still sees them as unpaired.
    seated = simulate_records(seated_base, true_parameters, config, seed_offset=123)

    lying_split = split_subjects([r.subject_id for r in lying], (0.6, 0.2, 0.2), 2)
    seated_split = split_subjects([r.subject_id for r in seated], (0.6, 0.2, 0.2), 3)
    sets = {
        "lt": select_split(lying, lying_split, "train"),
        "lv": select_split(lying, lying_split, "validation"),
        "lx": select_split(lying, lying_split, "test"),
        "st": select_split(seated, seated_split, "train"),
        "sv": select_split(seated, seated_split, "validation"),
        "sx": select_split(seated, seated_split, "test"),
    }
    fast = replace(
        config,
        optimization=replace(config.optimization, max_iterations=1, population_size=2),
        bootstrap_iterations=5,
    )
    model = train_calibration(sets["lt"], sets["st"], sets["lv"], sets["sv"], fast)
    metrics = evaluate_split(sets["lx"], sets["sx"], model, fast, 999, bootstrap=True)
    values = model.selected.parameters.as_array()
    assert values.shape == (5,)
    assert np.all((values >= 0) & (values <= 1))
    assert np.isfinite(metrics.raw_mmd)
    assert np.isfinite(metrics.calibrated_mmd)
    assert np.isclose(metrics.raw_mmd**2, metrics.raw_mmd2)
    assert np.isclose(metrics.calibrated_mmd**2, metrics.calibrated_mmd2)
    assert metrics.bootstrap_mmd2_reduction_ci95 is not None
    assert metrics.bootstrap_mmd_reduction_ci95 is not None


def test_known_synthetic_parameters_beat_identity(config):
    lying = make_records("shared", subjects=5, windows_per_subject=2, seed=21)
    true_parameters = SimulationParameters(0.5, 0.4, 0.35, 0.3, 0.25)
    seated = simulate_records(lying, true_parameters, config, seed_offset=777)
    scaler, bandwidths = fit_training_geometry(lying, seated, config)
    target = scaler.transform(flatten_features(seated))
    _, identity_mmd, _ = score_parameters(
        SimulationParameters(0, 0, 0, 0, 0),
        lying,
        target,
        scaler,
        bandwidths,
        config,
        seed_offset=777,
    )
    _, true_mmd, _ = score_parameters(
        true_parameters,
        lying,
        target,
        scaler,
        bandwidths,
        config,
        seed_offset=777,
    )
    assert true_mmd < identity_mmd
    assert true_mmd < 1e-12
