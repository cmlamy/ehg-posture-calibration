"""Synthetic EHG fixtures."""

from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from ehg_calibration.config import ExperimentConfig, load_config
from ehg_calibration.types import RecordWindows


@pytest.fixture
def config() -> ExperimentConfig:
    base = load_config("configs/default.json")
    return replace(
        base,
        trim_seconds=0,
        window_seconds=8,
        max_windows_per_subject=3,
        bootstrap_iterations=20,
        optimization=replace(
            base.optimization,
            restarts=1,
            population_size=2,
            max_iterations=1,
            tolerance=0.1,
        ),
    )


def make_records(
    prefix: str,
    subjects: int = 6,
    windows_per_subject: int = 3,
    fs: float = 20,
    seconds: float = 8,
    seed: int = 1,
) -> list[RecordWindows]:
    rng = np.random.default_rng(seed)
    time = np.arange(int(fs * seconds)) / fs
    records = []
    for subject in range(subjects):
        windows = []
        for window_index in range(windows_per_subject):
            channels = []
            for channel in range(3):
                phase = 0.2 * subject + 0.3 * channel + 0.1 * window_index
                signal = (
                    np.sin(2 * np.pi * 0.35 * time + phase)
                    + 0.3 * np.sin(2 * np.pi * 0.8 * time + phase / 2)
                    + 0.05 * rng.normal(size=len(time))
                )
                channels.append(signal)
            windows.append(channels)
        records.append(
            RecordWindows(
                record_id=f"{prefix}_r{subject}",
                subject_id=f"{prefix}_s{subject}",
                windows=np.asarray(windows),
                fs=fs,
            )
        )
    return records


@pytest.fixture
def synthetic_records() -> list[RecordWindows]:
    return make_records("lying")
