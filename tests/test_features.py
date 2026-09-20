import numpy as np

from ehg_calibration.features import FEATURE_NAMES, extract_features, extract_window_features


def test_feature_shape_and_finiteness(synthetic_records):
    record = synthetic_records[0]
    features = extract_features(record.windows, record.fs)
    assert features.shape == (len(record.windows), len(FEATURE_NAMES))
    assert np.isfinite(features).all()
    scalar = np.asarray(
        [extract_window_features(window, record.fs) for window in record.windows]
    )
    assert np.allclose(features, scalar)
