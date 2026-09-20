import numpy as np

from ehg_calibration.data import (
    _icelandic_channels,
    _read_channel_indices,
    _parse_comments,
    _tpehg_channels,
    _tpehgt_inferred_subject,
    _tpehgt_channels,
)


def test_tpehgt_profile_excludes_filtered_and_toco_channels():
    names = [
        "EHG1",
        "EHG1_Butter-4-bi-0.08-5",
        "EHG2",
        "EHG2_Butter-4-bi-0.08-5",
        "EHG3",
        "EHG3_Butter-4-bi-0.08-5",
        "TOCO",
        "TOCO_Butter-4-bi-0.08-5",
    ]
    signals = np.arange(80).reshape(10, 8)
    selected, selected_names = _tpehgt_channels(names, signals)
    assert selected_names == ["EHG1", "EHG2", "EHG3"]
    assert np.array_equal(selected, signals[:, [0, 2, 4]])


def test_tpehg_profile_excludes_nine_filtered_copies():
    names = [
        "1",
        "1_DOCFILT-4-0.08-4",
        "1_DOCFILT-4-0.3-3",
        "1_DOCFILT-4-0.3-4",
        "2",
        "2_DOCFILT-4-0.08-4",
        "2_DOCFILT-4-0.3-3",
        "2_DOCFILT-4-0.3-4",
        "3",
        "3_DOCFILT-4-0.08-4",
        "3_DOCFILT-4-0.3-3",
        "3_DOCFILT-4-0.3-4",
    ]
    signals = np.arange(120).reshape(10, 12)
    selected, selected_names = _tpehg_channels(names, signals)
    assert selected_names == ["EHG1", "EHG2", "EHG3"]
    assert np.array_equal(selected, signals[:, [0, 4, 8]])


def test_icelandic_profile_builds_three_bipolar_channels():
    # Reproduce the lexicographic ordering in real PhysioNet headers.
    channel_names = sorted([f"EHG{i}" for i in range(1, 17)])
    electrode_values = {f"EHG{i}": i for i in range(1, 17)}
    signals = np.tile([electrode_values[name] for name in channel_names], (5, 1))
    selected, names = _icelandic_channels(channel_names, signals)
    assert selected.shape == (5, 3)
    assert names == ["E2-E3", "E6-E7", "E10-E11"]
    assert np.all(selected == -1)


def test_icelandic_profile_reads_only_required_electrodes():
    names = sorted([f"EHG{i}" for i in range(1, 17)])
    indices = _read_channel_indices("icelandic", names)
    assert {names[index] for index in indices} == {
        "EHG2",
        "EHG3",
        "EHG6",
        "EHG7",
        "EHG10",
        "EHG11",
    }


def test_tpehgt_repeat_visits_share_an_inferred_subject():
    metadata = {
        "rectype": "Preterm",
        "gestation": "34",
        "age": "33",
        "parity": "0",
        "abortions": "1",
        "placental_position": "front",
        "smoker": "no",
    }
    first = _tpehgt_inferred_subject("tpehgt_p002", metadata)
    second = _tpehgt_inferred_subject("tpehgt_p003", metadata)
    assert first == second
    assert first.startswith("tpehgt-")


def test_icelandic_comment_keys_with_spaces_are_parsed():
    metadata = _parse_comments(
        ["ID:ice002", "Record type:pregnancy", "Gestational age at recording(w/d):38/1"]
    )
    assert metadata["id"] == "ice002"
    assert metadata["record_type"] == "pregnancy"
    assert metadata["gestational_age_at_recording(w/d)"] == "38/1"
