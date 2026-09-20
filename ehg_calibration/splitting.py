"""Reproducible subject-level data splitting."""

from __future__ import annotations

import numpy as np

from .types import DomainSplit, RecordWindows


def split_subjects(
    subject_ids: list[str] | tuple[str, ...],
    fractions: tuple[float, float, float],
    seed: int,
) -> DomainSplit:
    """Split unique subject IDs, guaranteeing at least one subject per set."""
    unique = np.array(sorted(set(subject_ids)), dtype=object)
    if len(unique) < 3:
        raise ValueError("At least three distinct subjects are required per domain")

    rng = np.random.default_rng(seed)
    shuffled = unique[rng.permutation(len(unique))]
    raw_counts = np.asarray(fractions) * len(unique)
    counts = np.floor(raw_counts).astype(int)
    counts[counts == 0] = 1
    while counts.sum() > len(unique):
        index = int(np.argmax(counts))
        counts[index] -= 1
    while counts.sum() < len(unique):
        remainders = raw_counts - np.floor(raw_counts)
        index = int(np.argmax(remainders - counts * 1e-12))
        counts[index] += 1

    n_train, n_validation, _ = (int(x) for x in counts)
    return DomainSplit(
        train=tuple(str(x) for x in shuffled[:n_train]),
        validation=tuple(
            str(x) for x in shuffled[n_train : n_train + n_validation]
        ),
        test=tuple(str(x) for x in shuffled[n_train + n_validation :]),
    )


def select_split(
    records: list[RecordWindows], split: DomainSplit, name: str
) -> list[RecordWindows]:
    """Select records whose subject belongs to a named split."""
    allowed = set(getattr(split, name))
    return [record for record in records if record.subject_id in allowed]


def assert_disjoint(split: DomainSplit) -> None:
    """Raise if a subject appears in more than one split."""
    train, validation, test = map(set, (split.train, split.validation, split.test))
    if train & validation or train & test or validation & test:
        raise AssertionError("Subject leakage detected between splits")
