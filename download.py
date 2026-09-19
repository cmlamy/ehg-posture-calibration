"""
download.py

Downloads the three public EHG datasets used in this project, straight
from PhysioNet, into local folders under data/.

Run once:
    python download.py

Datasets:
    - TPEHG    : Term-Preterm EHG Database (300 women, lying down / clinical)
    - TPEHGT   : Term-Preterm EHG DataSet with Tocogram (26 records, w/ contraction labels)
    - Icelandic: Icelandic 16-electrode EHG Database (45 women, seated)
"""

import os
import wfdb

DATASETS = {
    "tpehgdb": "data/tpehg",
    "tpehgt": "data/tpehgt",
    "ehgdb": "data/icelandic",
}


def download_all():
    for db_name, target_dir in DATASETS.items():
        os.makedirs(target_dir, exist_ok=True)
        print(f"Downloading '{db_name}' into {target_dir} ...")
        try:
            wfdb.dl_database(db_name, dl_dir=target_dir)
            print(f"  done: {len(os.listdir(target_dir))} files")
        except Exception as e:
            print(f"  FAILED to download {db_name}: {e}")
            print("  Check your network connection, or download manually from:")
            print(f"  https://physionet.org/content/{db_name}/")


def verify():
    """Quick check that .hea and .dat files actually landed."""
    print("\nVerifying downloads...")
    all_ok = True
    for db_name, target_dir in DATASETS.items():
        if not os.path.isdir(target_dir):
            print(f"  [MISSING] {target_dir} does not exist")
            all_ok = False
            continue
        files = os.listdir(target_dir)
        hea_files = [f for f in files if f.endswith(".hea")]
        dat_files = [f for f in files if f.endswith(".dat")]
        status = "OK" if hea_files and dat_files else "INCOMPLETE"
        if status == "INCOMPLETE":
            all_ok = False
        print(f"  [{status}] {target_dir}: {len(hea_files)} .hea, {len(dat_files)} .dat")
    if all_ok:
        print("\nAll three datasets downloaded successfully.")
    else:
        print("\nSomething is missing — see 'if something goes wrong' in the calibration doc.")
    return all_ok


if __name__ == "__main__":
    download_all()
    verify()
