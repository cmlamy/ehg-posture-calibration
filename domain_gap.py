"""
domain_gap.py

The "detective test": can a classifier tell clinical (lying down)
windows apart from seated windows, using only the 7 features from
features.py? AUC near 1.0 means yes, easily — proving the posture
gap is real. AUC near 0.5 means the classifier can't tell, which is
the goal after calibration (simulate.py, built next).

Splits by WOMAN, not by window — otherwise the same woman's windows
leak between train and test and the score looks better than it is.
"""

import glob
import os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

from load import load_tpehg, load_tpehgt, load_icelandic
from features import to_windows, windows_to_features


def _record_ids(folder, ext=".hea"):
    return sorted(f[:-len(ext)] for f in os.listdir(folder) if f.endswith(ext))


def build_dataset(tpehg_dir="data/tpehg", tpehgt_dir="data/tpehgt",
                   icelandic_dir="data/icelandic", max_records_per_set=None):
    """
    Returns X (features), y (0=clinical, 1=seated), groups (woman/record id).

    NOTE on groups: we use the record id as a stand-in for "woman" here.
    TPEHG/TPEHGT and the Icelandic database both have some women with
    repeat recordings — if you can extract a true participant id from
    the header comments, swap it in here. Until then, this is a
    reasonable but approximate grouping; flag this to judges as-is.
    """
    X, y, groups = [], [], []

    clinical_sources = [
        (tpehg_dir, load_tpehg),
        (tpehgt_dir, load_tpehgt),
    ]
    for folder, loader in clinical_sources:
        if not os.path.isdir(folder):
            print(f"[skip] {folder} not found — run download.py first")
            continue
        ids = _record_ids(folder)
        if max_records_per_set:
            ids = ids[:max_records_per_set]
        for rid in ids:
            try:
                rec = loader(os.path.join(folder, rid))
            except Exception as e:
                print(f"  [skip] {rid}: {e}")
                continue
            windows = to_windows(rec["channels"], rec["fs"])
            feats = windows_to_features(windows, rec["fs"])
            X.append(feats)
            y.append(np.zeros(len(feats)))
            groups.append([rec["record_id"]] * len(feats))

    if os.path.isdir(icelandic_dir):
        ids = _record_ids(icelandic_dir)
        if max_records_per_set:
            ids = ids[:max_records_per_set]
        for rid in ids:
            try:
                rec = load_icelandic(os.path.join(icelandic_dir, rid))
            except Exception as e:
                print(f"  [skip] {rid}: {e}")
                continue
            windows = to_windows(rec["channels"], rec["fs"])
            feats = windows_to_features(windows, rec["fs"])
            X.append(feats)
            y.append(np.ones(len(feats)))
            groups.append([rec["record_id"]] * len(feats))
    else:
        print(f"[skip] {icelandic_dir} not found — run download.py first")

    if not X:
        raise RuntimeError("No data loaded — check that download.py ran successfully")

    return np.vstack(X), np.concatenate(y), np.concatenate(groups)


def domain_auc(X, y, groups, n_splits=5):
    """
    Grouped cross-validated AUC: can a logistic regression tell clinical
    from seated windows apart, without ever training and testing on the
    same woman?
    """
    n_groups = len(set(groups))
    n_splits = min(n_splits, n_groups)
    if n_splits < 2:
        raise ValueError("Need at least 2 distinct woman/record groups to cross-validate")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    gkf = GroupKFold(n_splits=n_splits)
    clf = LogisticRegression(max_iter=1000)
    proba = cross_val_predict(clf, X_scaled, y, groups=groups, cv=gkf,
                               method="predict_proba")[:, 1]
    return roc_auc_score(y, proba)


if __name__ == "__main__":
    print("Building dataset...")
    X, y, groups = build_dataset()
    print(f"  {X.shape[0]} windows, {X.shape[1]} features, "
          f"{len(set(groups))} record groups, "
          f"{int((y == 0).sum())} clinical / {int((y == 1).sum())} seated")

    print("\nComputing raw domain-gap AUC (before any calibration)...")
    auc = domain_auc(X, y, groups)
    print(f"\nRaw domain-gap AUC: {auc:.3f}")
    print("(1.0 = trivially distinguishable, 0.5 = indistinguishable)")
