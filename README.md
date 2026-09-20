# EHG posture calibration

This project learns a **bounded, stochastic transformation from lying EHG to
seated EHG**. It does not require paired recordings. Instead, it finds five
artifact-effect strengths that make transformed lying recordings statistically
closer to real seated recordings while penalizing destruction of the original
uterine signal.

The five modeled effects are maternal cardiac contamination, breathing,
fetal-movement-like transients, maternal skeletal-muscle artifact, and electrode
displacement/contact changes.

The numerical ranges in `configs/default.json` are engineering defaults, **not
clinically validated ranges**. Replace them with the ranges and citations from
your research before interpreting an experiment.

The primary optimization metric is multi-kernel squared Maximum Mean
Discrepancy (MMD²). Reports include both MMD² and MMD = sqrt(MMD²), with
reductions and bootstrap intervals on both scales. Every split is performed by
subject, independently in each posture domain:

- **train** optimizes several candidate parameter sets;
- **validation** selects one candidate without touching test subjects;
- **test** reports the final raw-versus-calibrated MMD² and MMD exactly once.

This is population-level, unpaired domain calibration. A low MMD does not prove
that a generated window is the true seated counterpart of an individual lying
window, nor does it identify a patient's actual heart or breathing rate.

## Repository layout

```text
ehg_calibration/
  cli.py            command-line experiment
  data.py           WFDB loading and channel selection
  preprocessing.py  filtering, resampling, trimming and windowing
  simulator.py      five-effect stochastic posture simulator
  features.py       EHG feature extraction
  mmd.py            multi-kernel MMD
  splitting.py      subject-level train/validation/test splitting
  training.py       bounded optimization and validation selection
  evaluation.py     held-out metrics and subject bootstrap
configs/default.json  editable physiological and training ranges
configs/legacy_v1.json  frozen pre-profile configuration
tests/                unit and synthetic integration tests
```

## Install

Python 3.10 or newer is recommended.

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
```

## Data

The included `laying-dataset/` directory is TPEHGT. Its records contain eight
stored signals, but the loader deliberately selects only the three **original
EHG channels** (`EHG1`, `EHG2`, `EHG3`). It excludes duplicate prefiltered
channels and both TOCO channels.

`laying-tpehg-dataset/` contains the additional TPEHG database: 300 pregnant
participants with one 30-minute record each. The `tpehg` profile reads only its
three original channels and excludes all nine supplied prefiltered copies.

Place the target-domain dataset in its own directory. For the Icelandic
16-electrode PhysioNet EHG database, use `--seated-profile icelandic`; the
loader resolves electrodes by name and constructs three configured bipolar
pairs before preprocessing.

Important: PhysioNet does **not** describe EHGDB as a controlled seated cohort.
Participants could change position during recording, and `pos` annotations mark
a change without naming the resulting posture. This dataset can test
lying-to-Icelandic-domain calibration, but it cannot by itself validate a
lying-to-seated physiological claim.

This workspace contains the complete EHGDB manifest in `seated-dataset/`:
every repeat visit, available annotation and image, metadata file, and the
MATLAB archive. All visits beginning with the same `ice###` identifier are
grouped as one woman. Labour records are retained locally but excluded from the
pregnancy-domain experiment unless `--include-target-labour` is passed.

If one woman has multiple records, supply a CSV mapping so records from that
woman cannot cross splits:

```csv
record_id,subject_id
tpehgt_p001,woman_001
tpehgt_p002,woman_001
```

Without a mapping, record IDs are approximate subject IDs and the CLI warns.

## Run

Start with a quick smoke experiment:

```bash
.venv/bin/ehg-calibrate \
  --lying-dir laying-dataset \
  --additional-lying-dir laying-tpehg-dataset \
  --additional-lying-profile tpehg \
  --seated-dir seated-dataset \
  --lying-profile tpehgt \
  --seated-profile icelandic \
  --config configs/default.json \
  --quick
```

Then run the full experiment:

```bash
.venv/bin/ehg-calibrate \
  --lying-dir laying-dataset \
  --additional-lying-dir laying-tpehg-dataset \
  --additional-lying-profile tpehg \
  --seated-dir seated-dataset \
  --lying-profile tpehgt \
  --seated-profile icelandic \
  --config configs/default.json \
  --output-dir results/run-001
```

### Five-fold nested cross-validation

Use nested subject-level cross-validation to obtain a less split-dependent
generalization estimate from the existing data. A quick smoke run trains five
small models:

```bash
.venv/bin/ehg-calibrate \
  --lying-dir laying-dataset \
  --additional-lying-dir laying-tpehg-dataset \
  --additional-lying-profile tpehg \
  --seated-dir seated-dataset \
  --lying-profile tpehgt \
  --seated-profile icelandic \
  --config configs/default.json \
  --nested-cv-folds 5 \
  --quick \
  --output-dir results/nested-cv-quick
```

Remove `--quick` for the full nested experiment and use a new output directory:

```bash
.venv/bin/ehg-calibrate \
  --lying-dir laying-dataset \
  --additional-lying-dir laying-tpehg-dataset \
  --additional-lying-profile tpehg \
  --seated-dir seated-dataset \
  --lying-profile tpehgt \
  --seated-profile icelandic \
  --config configs/default.json \
  --nested-cv-folds 5 \
  --output-dir results/nested-cv-full
```

For each outer fold, the command creates a new inner training/validation split,
fits and selects a model without its outer-test subjects, and evaluates only on
that fold's untouched subjects. Every subject appears in exactly one outer test
fold. The aggregate confidence interval bootstraps subjects within each fold
and combines the five held-out reductions. This interval is conditional on the
five fitted models; it does not refit a model inside every bootstrap sample.

Nested output uses the usual filenames. `metrics.json` contains aggregate and
per-fold metrics, `model.json` contains all five selected models, and
`splits.json` records every inner and outer subject assignment. There is no
single selected nested-CV model: the result is a cross-validated performance
estimate. A full five-fold run performs five complete optimizations and should
take approximately five times as long as a comparable one-split run.

The output directory receives `splits.json`, `model.json`,
`effective_config.json`, `metrics.json`, and `report.md`. Only `metrics.test` is
the final generalization result. Do not tune the model after inspecting it.

For runtime and balanced MMD estimation, each experiment deterministically
samples at most 40 subjects from each domain and at most six windows per
subject. All 300 TPEHG records remain available; change `seed` to run a
different balanced cohort or raise `max_subjects_per_domain` deliberately.

### Physiology profiles and migration

`configs/default.json` is schema version 2 and uses the `exploratory` profile
by default. Select the optional general-pregnancy reference profile explicitly:

```bash
.venv/bin/ehg-calibrate ... --physiology-profile general_pregnancy_reference
```

That profile uses Green et al. 2020's general-pregnancy reference intervals
(heart 65-114 bpm, breathing 9-23 breaths/min); it is not automatically
applied to every gestational age and does not imply a uniform sampling
distribution. The `heart_breathing_only` profile disables the other three
normalized controls by fixing their bounds at zero.

The frozen pre-profile configuration is `configs/legacy_v1.json`. Existing
flat configuration files and prior flat `effective_config.json` files remain
loadable as `legacy_v1`; they are not silently interpreted as schema version 2.
Use the optional respiratory mode explicitly when needed:

```bash
.venv/bin/ehg-calibrate ... \\
  --respiratory-amplitude-mode paper_sd_quarter_extrapolation
```

This mode applies the Martins et al. 2022-inspired extrapolation
`0.25 * std(source) * (r - mean(r)) / std(r)`. It is not a reproduction of
the paper's ECG-derived reference pipeline or a measured respiratory artifact
maximum. The simulator records the achieved artifact/source RMS ratio after
the source preprocessing stage in `metrics.json`; it does not renormalize a
filtered component back to full amplitude.

Heart and breathing reference values are evidence-labelled. Fetal/muscle
event settings, electrode settings, and artifact amplitude caps remain
explicit exploratory assumptions because the available sources do not report
those quantities in compatible units. Missing empirical annotation summaries
are stored as null, not treated as zero.

## Tests

```bash
.venv/bin/pytest
```

The tests use synthetic signals and do not require downloaded datasets.

## Standing posture

Standing output is implemented as a separate Monte Carlo sensitivity analysis.
It loads an already fitted calibration, keeps its parameters fixed, and never
optimizes against synthetic standing data. Because there is no measured
standing pregnancy EHG target, every standing output is labelled projected and
not validated.

Run a short smoke projection from the existing single-split calibration:

```bash
.venv/bin/python -m ehg_calibration.standing_cli \
  --calibration-results results/full-combined \
  --lying-dir laying-dataset \
  --additional-lying-dir laying-tpehg-dataset \
  --additional-lying-profile tpehg \
  --seated-dir seated-dataset \
  --lying-profile tpehgt \
  --seated-profile icelandic \
  --scenario standing_still \
  --quick \
  --output-dir results/standing-still-quick
```

For the final sensitivity demo, omit `--quick`; the default is 500 draws. The
supported scenarios are `standing_still`, `sit_to_stand_transition`, and
`walking`. The walking scenario uses target-derived electrode-event morphology
placed at sampled walking-step opportunities. It is not measured pregnant
walking EHG and does not use or claim external motion noise as pregnancy data.

When the calibration directory contains nested-CV results, the standing command
uses all five frozen fold models by default. Each model is applied only to its
own outer-held-out source subjects, and event evidence is estimated separately
from that fold's target training women:

```bash
.venv/bin/python -m ehg_calibration.standing_cli ... \
  --calibration-results results/nested-cv-quick \
  --scenario standing_still \
  --output-dir results/standing-nested-cv-full
```

Pass `--calibration-fold 1` only when a fold-specific diagnostic is desired.
Without that option, the aggregate projection covers all 40 outer-held-out
source subjects across the five models.

The command estimates jump rates and morphology only from the selected
calibration fold's target training women. Target validation and test women are
recorded as excluded in the output. It directly interpolates between quiet and
movement-associated detected rates; it does not multiply an incompatible
overall rate.

Each output directory contains:

- `standing_projection.json`: assumptions, central 95% projected simulation
  intervals, training-only event evidence, and Spearman sensitivity drivers;
- `standing_samples.jsonl`: every per-window sampled value, seed, source ID,
  event time, component setting, and metric;
- `standing_demo.npz`: original, fixed target-domain-calibrated, projected waveform
  bands, envelope bands, and representative components;
- `standing_demo_envelope.png`: labelled median and 95% pointwise simulation
  band;
- `standing_effective_config.json` and `report.md`.

The held-out TPEHG projection cohort does not currently provide aligned,
independently verified contraction labels, so the command reports
`contraction_detector_auc` as unavailable. It does not fabricate an AUC using
pseudo-labels. Simulation intervals represent scenario uncertainty conditional
on the model assumptions; they are not confidence intervals for real standing
pregnancy EHG.
