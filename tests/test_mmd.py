import numpy as np

from ehg_calibration.mmd import median_bandwidth, multi_kernel_mmd2


def test_mmd_is_small_for_same_distribution_and_larger_for_shift():
    rng = np.random.default_rng(4)
    x = rng.normal(size=(100, 4))
    same = rng.normal(size=(100, 4))
    shifted = rng.normal(loc=2.0, size=(100, 4))
    bandwidth = median_bandwidth(np.vstack([x, same, shifted]))
    same_score = multi_kernel_mmd2(x, same, (bandwidth / 2, bandwidth))
    shifted_score = multi_kernel_mmd2(x, shifted, (bandwidth / 2, bandwidth))
    assert same_score >= 0
    assert shifted_score > same_score


def test_mmd_is_symmetric():
    rng = np.random.default_rng(5)
    x = rng.normal(size=(20, 2))
    y = rng.normal(size=(30, 2))
    assert np.isclose(multi_kernel_mmd2(x, y, (1.0,)), multi_kernel_mmd2(y, x, (1.0,)))
