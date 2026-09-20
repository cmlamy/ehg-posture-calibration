from dataclasses import asdict
import json

import numpy as np

from conftest import make_records
from ehg_calibration.config import load_effective_config
from ehg_calibration.simulator import SimulationParameters, simulate_window_with_trace
from ehg_calibration.standing import (
    combine_nested_projection_results,
    load_standing_config,
    project_window,
    run_standing_projection,
)
from ehg_calibration.standing_events import detect_electrode_events


def _event_statistics():
    return {
        "quiet_event_rate_per_hour": 0.0,
        "movement_associated_event_rate_per_hour": 6.0,
        "amplitude_ratio_samples": [0.1, 0.2],
        "decay_seconds_samples": [0.5, 1.0],
    }


def test_effective_config_round_trip_loads_completed_experiment(config, tmp_path):
    path = tmp_path / "effective_config.json"
    path.write_text(json.dumps(asdict(config)), encoding="utf-8")
    loaded = load_effective_config(path)
    assert loaded.profile_name == config.profile_name
    assert loaded.target_fs == config.target_fs
    assert loaded.max_subjects_per_domain == config.max_subjects_per_domain


def test_zero_standing_perturbation_reproduces_fixed_calibration(config):
    standing_config = load_standing_config("configs/standing_projection.json")
    original = make_records("source", subjects=1, windows_per_subject=1)[0].windows[0]
    parameters = SimulationParameters(0.2, 0.1, 0.1, 0.1, 0.2)
    trace = simulate_window_with_trace(
        original, config.target_fs, parameters, config, np.random.default_rng(7)
    )
    projected = project_window(
        trace,
        config.target_fs,
        "standing_still",
        heart_rate_multiplier=1.0,
        event_rate_per_hour=0.0,
        amplitude_ratio_samples=[0.2],
        decay_seconds_samples=[1.0],
        transition_amplitude_ratio_samples=[0.2],
        transition_decay_seconds_samples=[1.0],
        rng=np.random.default_rng(8),
        calibration_config=config,
        standing_config=standing_config,
    )
    assert np.array_equal(projected.final_signal, trace.final_signal)
    assert not np.any(projected.cardiac_component)
    assert not np.any(projected.electrode_component)
    assert projected.sampled["event_count"] == 0


def test_transition_adds_one_position_change_derived_event(config):
    standing_config = load_standing_config("configs/standing_projection.json")
    original = make_records("source", subjects=1, windows_per_subject=1)[0].windows[0]
    trace = simulate_window_with_trace(
        original,
        config.target_fs,
        SimulationParameters(0.1, 0.1, 0.1, 0.1, 0.1),
        config,
        np.random.default_rng(3),
    )
    projected = project_window(
        trace,
        config.target_fs,
        "sit_to_stand_transition",
        1.0,
        0.0,
        [0.2],
        [1.0],
        [0.2],
        [1.0],
        np.random.default_rng(4),
        config,
        standing_config,
    )
    assert projected.sampled["transition_event"] is True
    assert projected.sampled["event_count"] == 1
    assert np.any(projected.electrode_component)


def test_walking_uses_one_cadence_timed_event_process(config):
    standing_config = load_standing_config("configs/standing_projection.json")
    original = make_records("source", subjects=1, windows_per_subject=1)[0].windows[0]
    trace = simulate_window_with_trace(
        original,
        config.target_fs,
        SimulationParameters(0.1, 0.1, 0.1, 0.1, 0.1),
        config,
        np.random.default_rng(11),
    )
    projected = project_window(
        trace,
        config.target_fs,
        "walking",
        1.0,
        10_000.0,
        [0.2],
        [1.0],
        [0.5],
        [2.0],
        np.random.default_rng(12),
        config,
        standing_config,
    )
    assert projected.sampled["walking"] is True
    assert projected.sampled["transition_event"] is False
    assert projected.sampled["walking_cadence_steps_per_minute"] is not None
    assert projected.sampled["event_count"] > 1


def test_standing_projection_reports_simulation_intervals_and_exact_samples(config):
    standing_config = load_standing_config("configs/standing_projection.json")
    records = make_records("source", subjects=2, windows_per_subject=1)
    result = run_standing_projection(
        records,
        SimulationParameters(0.2, 0.1, 0.1, 0.1, 0.2),
        config,
        standing_config,
        _event_statistics(),
        "standing_still",
        draws=5,
        calibration_seed_offset=80_000,
    )
    assert result.summary["status"] == "projected_not_validated"
    assert result.summary["standing_mmd_optimization_performed"] is False
    assert result.summary["fixed_target_domain_calibration"] is True
    assert result.summary["contraction_detector_auc"]["status"] == "unavailable"
    assert len(result.samples) == 10
    interval = result.summary["metrics"]["rms_ratio_to_target_calibrated"]
    assert interval["p2_5"] <= interval["median"] <= interval["p97_5"]
    assert result.demo["standing_median"].shape == records[0].windows[0].shape

    combined = combine_nested_projection_results([(1, result), (2, result)])
    assert combined.summary["nested_cross_validation_projection"] is True
    assert combined.summary["calibration_folds"] == [1, 2]
    assert len(combined.samples) == 20
    assert {sample["calibration_fold"] for sample in combined.samples} == {1, 2}


def test_jump_detector_finds_exponential_return():
    fs = 20.0
    samples = 800
    rng = np.random.default_rng(2)
    signal = 0.01 * rng.normal(size=(3, samples))
    start = 200
    time = np.arange(samples - start) / fs
    signal[1, start:] += 2.0 * np.exp(-time / 1.5)
    detector = load_standing_config("configs/standing_projection.json")["event_detector"]
    events = detect_electrode_events(signal, fs, detector)
    assert events
    assert any(abs(event.time_seconds - start / fs) < 0.2 for event in events)
