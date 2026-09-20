import numpy as np
from dataclasses import replace

from ehg_calibration.simulator import SimulationParameters, simulate_records


def test_zero_strength_is_identity(config, synthetic_records):
    params = SimulationParameters(0, 0, 0, 0, 0)
    result = simulate_records(synthetic_records, params, config)
    for before, after in zip(synthetic_records, result, strict=True):
        assert np.array_equal(before.windows, after.windows)


def test_simulation_is_reproducible_and_changes_signal(config, synthetic_records):
    params = SimulationParameters(0.4, 0.3, 0.5, 0.4, 0.2)
    first = simulate_records(synthetic_records, params, config, seed_offset=9)
    second = simulate_records(synthetic_records, params, config, seed_offset=9)
    assert np.array_equal(first[0].windows, second[0].windows)
    assert not np.array_equal(first[0].windows, synthetic_records[0].windows)
    assert first[0].windows.shape == synthetic_records[0].windows.shape


def test_parameter_bounds_are_enforced(config, synthetic_records):
    params = SimulationParameters(1.1, 0, 0, 0, 0)
    try:
        simulate_records(synthetic_records[:1], params, config)
    except ValueError as error:
        assert "outside configured range" in str(error)
    else:
        raise AssertionError("Expected out-of-range parameter rejection")


def test_paper_respiratory_mode_is_reproducible(config, synthetic_records):
    physiology = replace(
        config.physiology,
        respiratory_amplitude_mode="paper_sd_quarter_extrapolation",
    )
    paper_config = replace(config, physiology=physiology)
    params = SimulationParameters(0, 0.5, 0, 0, 0)
    first = simulate_records(synthetic_records, params, paper_config, seed_offset=12)
    second = simulate_records(synthetic_records, params, paper_config, seed_offset=12)
    assert np.array_equal(first[0].windows, second[0].windows)
    assert not np.array_equal(first[0].windows, synthetic_records[0].windows)


def test_fixed_zero_bounds_disable_ablation_effects(config, synthetic_records):
    ranges = dict(config.parameter_ranges)
    ranges.update({"fetal_movement": (0.0, 0.0), "muscle": (0.0, 0.0), "electrode_shift": (0.0, 0.0)})
    ablation = replace(config, parameter_ranges=ranges)
    params = SimulationParameters(0.2, 0.2, 0.0, 0.0, 0.0)
    result = simulate_records(synthetic_records, params, ablation)
    assert not np.array_equal(result[0].windows, synthetic_records[0].windows)
