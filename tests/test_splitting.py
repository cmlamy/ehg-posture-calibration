from ehg_calibration.splitting import assert_disjoint, split_subjects
from ehg_calibration.preprocessing import balance_subject_counts

from conftest import make_records


def test_subject_split_is_reproducible_and_disjoint():
    subjects = [f"s{i}" for i in range(10)]
    first = split_subjects(subjects, (0.6, 0.2, 0.2), seed=42)
    second = split_subjects(subjects, (0.6, 0.2, 0.2), seed=42)
    assert first == second
    assert_disjoint(first)
    assert set(first.train + first.validation + first.test) == set(subjects)
    assert tuple(map(len, (first.train, first.validation, first.test))) == (6, 2, 2)


def test_subject_split_requires_three_subjects():
    try:
        split_subjects(["a", "b"], (0.6, 0.2, 0.2), seed=1)
    except ValueError as error:
        assert "three" in str(error)
    else:
        raise AssertionError("Expected split_subjects to reject two subjects")


def test_domain_subject_counts_are_balanced():
    first = make_records("first", subjects=10, windows_per_subject=1)
    second = make_records("second", subjects=6, windows_per_subject=1)
    balanced_first, balanced_second = balance_subject_counts(first, second, 8, 3)
    assert len({record.subject_id for record in balanced_first}) == 6
    assert len({record.subject_id for record in balanced_second}) == 6
