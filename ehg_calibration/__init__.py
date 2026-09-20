"""EHG posture-domain calibration."""

from .config import ExperimentConfig, load_config
from .types import Record, RecordWindows

__all__ = ["ExperimentConfig", "Record", "RecordWindows", "load_config"]
__version__ = "0.1.0"
