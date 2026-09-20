"""WFDB dataset loading with explicit channel profiles."""

from __future__ import annotations

import csv
import hashlib
import re
import warnings
from pathlib import Path
from typing import Callable

import numpy as np

from .types import Record

ICELANDIC_BIPOLAR_PAIRS = ((2, 3), (6, 7), (10, 11))


def read_subject_map(path: str | Path | None) -> dict[str, str]:
    """Read `record_id,subject_id` mappings from CSV."""
    if path is None:
        return {}
    result: dict[str, str] = {}
    with Path(path).open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not {"record_id", "subject_id"} <= set(
            reader.fieldnames
        ):
            raise ValueError("Subject map requires record_id and subject_id columns")
        for row in reader:
            result[row["record_id"].strip()] = row["subject_id"].strip()
    return result


def _parse_comments(comments: list[str] | None) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for comment in comments or []:
        text = comment.strip().lstrip("#").strip()
        if not text:
            continue
        if ":" in text:
            key, value = text.split(":", 1)
        else:
            match = re.match(r"([^\s]+)\s+(.*)", text)
            if not match:
                continue
            key, value = match.groups()
        normalized_key = re.sub(r"\s+", "_", key.strip()).lower()
        metadata[normalized_key] = value.strip()
    return metadata


def _tpehgt_inferred_subject(record_id: str, metadata: dict[str, str]) -> str:
    """Group repeat TPEHGT visits using stable pregnancy metadata.

    The seven-field signature yields the documented 8 preterm and 10 term
    pregnancies in TPEHGT. Non-pregnant records lack identifying metadata and
    therefore remain separate records.
    """
    if metadata.get("rectype", "").strip().lower() == "non-pregnant":
        return record_id
    keys = (
        "rectype",
        "gestation",
        "age",
        "parity",
        "abortions",
        "placental_position",
        "smoker",
    )
    values = tuple(metadata.get(key, "").strip().lower() for key in keys)
    if any(not value or value in {"none", "n/a"} for value in values):
        return record_id
    digest = hashlib.blake2b("|".join(values).encode(), digest_size=6).hexdigest()
    return f"tpehgt-{digest}"


def _tpehgt_channels(names: list[str], signals: np.ndarray) -> tuple[np.ndarray, list[str]]:
    wanted = ("EHG1", "EHG2", "EHG3")
    by_name = {name.upper(): i for i, name in enumerate(names)}
    missing = [name for name in wanted if name not in by_name]
    if missing:
        raise ValueError(f"TPEHGT record is missing original channels: {missing}")
    indices = [by_name[name] for name in wanted]
    return signals[:, indices], list(wanted)


def _tpehg_channels(names: list[str], signals: np.ndarray) -> tuple[np.ndarray, list[str]]:
    """Select original channels 1/2/3, excluding nine filtered copies."""
    wanted = ("1", "2", "3")
    by_name = {name.strip(): i for i, name in enumerate(names)}
    missing = [name for name in wanted if name not in by_name]
    if missing:
        raise ValueError(f"TPEHG record is missing original channels: {missing}")
    indices = [by_name[name] for name in wanted]
    return signals[:, indices], [f"EHG{name}" for name in wanted]


def _icelandic_channels(
    names: list[str], signals: np.ndarray
) -> tuple[np.ndarray, list[str]]:
    # PhysioNet headers list channels lexicographically (EHG1, EHG10, ...,
    # EHG2), so array position is not electrode number. Resolve by name.
    by_electrode: dict[int, int] = {}
    for index, name in enumerate(names):
        match = re.fullmatch(r"EHG\s*0*(\d+)", name.strip(), flags=re.IGNORECASE)
        if match:
            by_electrode[int(match.group(1))] = index
    required = {electrode for pair in ICELANDIC_BIPOLAR_PAIRS for electrode in pair}
    missing = sorted(required - set(by_electrode))
    if missing:
        raise ValueError(f"Icelandic record is missing electrode channels: {missing}")
    bipolar = np.column_stack(
        [
            signals[:, by_electrode[a]] - signals[:, by_electrode[b]]
            for a, b in ICELANDIC_BIPOLAR_PAIRS
        ]
    )
    return bipolar, [f"E{a}-E{b}" for a, b in ICELANDIC_BIPOLAR_PAIRS]


def _generic_channels(names: list[str], signals: np.ndarray) -> tuple[np.ndarray, list[str]]:
    indices = [
        i
        for i, name in enumerate(names)
        if "EHG" in name.upper()
        and "TOCO" not in name.upper()
        and "BUTTER" not in name.upper()
        and "FILTER" not in name.upper()
    ]
    if not indices:
        raise ValueError(
            "Generic profile could not identify EHG channels; use recognizable names "
            "or add a dataset profile"
        )
    return signals[:, indices], [names[i] for i in indices]


PROFILE_SELECTORS: dict[
    str, Callable[[list[str], np.ndarray], tuple[np.ndarray, list[str]]]
] = {
    "tpehgt": _tpehgt_channels,
    "tpehg": _tpehg_channels,
    "icelandic": _icelandic_channels,
    "generic": _generic_channels,
}


def _read_channel_indices(profile: str, names: list[str]) -> list[int]:
    """Choose only channels needed by a profile before decoding a large `.dat`."""
    if profile == "tpehgt":
        wanted = {"EHG1", "EHG2", "EHG3"}
        indices = [i for i, name in enumerate(names) if name.upper() in wanted]
    elif profile == "tpehg":
        indices = [i for i, name in enumerate(names) if name.strip() in {"1", "2", "3"}]
    elif profile == "icelandic":
        wanted_numbers = {
            electrode for pair in ICELANDIC_BIPOLAR_PAIRS for electrode in pair
        }
        indices = []
        for i, name in enumerate(names):
            match = re.fullmatch(r"EHG\s*0*(\d+)", name.strip(), flags=re.IGNORECASE)
            if match and int(match.group(1)) in wanted_numbers:
                indices.append(i)
    else:
        indices = [
            i
            for i, name in enumerate(names)
            if "EHG" in name.upper()
            and "TOCO" not in name.upper()
            and "BUTTER" not in name.upper()
            and "FILTER" not in name.upper()
        ]
    if not indices:
        raise ValueError(f"No usable channels found for {profile} profile")
    return indices


def load_wfdb_directory(
    directory: str | Path,
    profile: str,
    subject_map_path: str | Path | None = None,
) -> list[Record]:
    """Load every `.hea` record in a directory using a named channel profile."""
    try:
        import wfdb
    except ImportError as exc:  # pragma: no cover - environment-specific message
        raise RuntimeError("Install project dependencies before loading WFDB data") from exc

    root = Path(directory)
    if not root.is_dir():
        raise FileNotFoundError(f"Dataset directory does not exist: {root}")
    if profile not in PROFILE_SELECTORS:
        raise ValueError(f"Unknown profile {profile!r}; choose {sorted(PROFILE_SELECTORS)}")

    subject_map = read_subject_map(subject_map_path)
    headers = sorted(root.glob("*.hea"))
    if not headers:
        raise FileNotFoundError(f"No .hea records found in {root}")
    if not subject_map and profile == "generic":
        warnings.warn(
            f"No subject map supplied for {root}; record IDs will stand in for subjects. "
            "Repeated recordings from one woman can leak across splits.",
            stacklevel=2,
        )

    records: list[Record] = []
    selector = PROFILE_SELECTORS[profile]
    for header in headers:
        record_id = header.stem
        record_path = str(header.with_suffix(""))
        wfdb_header = wfdb.rdheader(record_path)
        channel_indices = _read_channel_indices(profile, list(wfdb_header.sig_name))
        wfdb_record = wfdb.rdrecord(record_path, channels=channel_indices)
        if wfdb_record.p_signal is None:
            raise ValueError(f"WFDB returned no physical signal for {record_id}")
        selected, selected_names = selector(
            list(wfdb_record.sig_name), np.asarray(wfdb_record.p_signal, dtype=float)
        )
        metadata = _parse_comments(wfdb_record.comments)
        inferred_subject = record_id
        if profile == "icelandic":
            match = re.match(r"^(ice\d{3})_", record_id, flags=re.IGNORECASE)
            if match:
                inferred_subject = match.group(1).lower()
        elif profile == "tpehgt":
            inferred_subject = _tpehgt_inferred_subject(record_id, metadata)
        records.append(
            Record(
                record_id=record_id,
                subject_id=subject_map.get(record_id, inferred_subject),
                # Raw WFDB physical samples arrive as float64. Float32 is more
                # than adequate for 16-bit source data and halves the resident
                # memory before filtering/downsampling.
                signals=selected.T.astype(np.float32, copy=True),
                fs=float(wfdb_record.fs),
                channel_names=tuple(selected_names),
                metadata=metadata,
            )
        )
    unknown = set(subject_map) - {record.record_id for record in records}
    if unknown:
        warnings.warn(f"Subject map contains unknown records: {sorted(unknown)}", stacklevel=2)
    return records
