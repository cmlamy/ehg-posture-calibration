"""Multi-kernel Maximum Mean Discrepancy utilities."""

from __future__ import annotations

import numpy as np
from scipy.spatial.distance import cdist, pdist


def median_bandwidth(samples: np.ndarray, maximum_samples: int = 1000) -> float:
    """Median non-zero Euclidean distance, with deterministic subsampling."""
    values = np.asarray(samples, dtype=float)
    if len(values) > maximum_samples:
        indices = np.linspace(0, len(values) - 1, maximum_samples, dtype=int)
        values = values[indices]
    distances = pdist(values, metric="euclidean")
    nonzero = distances[distances > 1e-12]
    return float(np.median(nonzero)) if len(nonzero) else 1.0


def multi_kernel_mmd2(
    x: np.ndarray,
    y: np.ndarray,
    bandwidths: tuple[float, ...] | list[float] | np.ndarray,
) -> float:
    """Biased, non-negative squared MMD averaged over RBF kernels."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.ndim != 2 or y.ndim != 2 or x.shape[1] != y.shape[1]:
        raise ValueError("MMD inputs must be 2D with equal feature counts")
    if len(x) == 0 or len(y) == 0:
        raise ValueError("MMD requires non-empty samples")
    bandwidths = np.asarray(bandwidths, dtype=float)
    if np.any(bandwidths <= 0):
        raise ValueError("MMD bandwidths must be positive")

    xx = cdist(x, x, metric="sqeuclidean")
    yy = cdist(y, y, metric="sqeuclidean")
    xy = cdist(x, y, metric="sqeuclidean")
    score = 0.0
    for bandwidth in bandwidths:
        denominator = 2 * bandwidth**2
        score += (
            np.exp(-xx / denominator).mean()
            + np.exp(-yy / denominator).mean()
            - 2 * np.exp(-xy / denominator).mean()
        )
    return float(max(0.0, score / len(bandwidths)))
