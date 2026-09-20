"""Shared data structures."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.floating]


@dataclass(frozen=True)
class Record:
    """One continuous multi-channel EHG recording."""

    record_id: str
    subject_id: str
    signals: FloatArray
    fs: float
    channel_names: tuple[str, ...]
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RecordWindows:
    """Preprocessed windows belonging to one subject/record."""

    record_id: str
    subject_id: str
    windows: FloatArray
    fs: float


@dataclass(frozen=True)
class DomainSplit:
    """A subject-disjoint split for one domain."""

    train: tuple[str, ...]
    validation: tuple[str, ...]
    test: tuple[str, ...]
