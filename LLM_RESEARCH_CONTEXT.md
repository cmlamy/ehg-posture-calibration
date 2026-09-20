# EHG Posture Calibration: Context for Literature Research

Use this document together with `configs/default.json` when researching and proposing scientifically defensible simulator ranges. Do not change the code or configuration solely from this brief. First verify each claim against the original paper and explain any unit conversion.

## Project goal

This is an unpaired, population-level calibration experiment for uterine electrohysterography (EHG). The project starts with EHG recordings from people recorded in a lying domain and applies a stochastic five-effect simulator. The simulated lying distribution is compared with a separate target-domain EHG dataset using multi-kernel Maximum Mean Discrepancy (MMD).

The optimization goal is to find one global parameter vector:

```text
theta = (heart, breathing, fetal_movement, muscle, electrode_shift)
```

such that the transformed lying distribution is as close as possible to the target distribution while preserving the original waveform:

```text
loss = MMD(transformed_lying, target)
     + preservation_penalty
     + small_parameter_penalty
```

The recordings in the two domains do not belong to the same women. Paired recording correspondence is not assumed or required. Subject-level splits are used independently in each domain to prevent windows from the same woman appearing in multiple splits.

## Datasets and channel representations

### Lying domain: TPEHGT

The loader selects the original channels `EHG1`, `EHG2`, and `EHG3`. It does not select duplicate filtered channels or TOCO channels. These are stored EHG channels, not bipolar differences constructed by this loader.

### Target domain: Icelandic PhysioNet EHGDB

The loader selects the named electrodes and constructs three bipolar channels:

```text
EHG2 - EHG3
EHG6 - EHG7
EHG10 - EHG11
```

The Icelandic header example is sampled at 200 Hz and contains physical-unit gain information. `wfdb.rdrecord(...).p_signal` applies the WFDB baseline/gain conversion before the selected channels are passed to the pipeline.

This channel and hardware mismatch is important: a successful MMD reduction would demonstrate similarity to the Icelandic recording domain, not isolate posture alone. The Icelandic dataset is not posture-controlled seated ground truth.

## Shared preprocessing

After loading and channel selection, both domains are processed as follows:

1. Fourth-order Butterworth band-pass filter from 0.2 to 3.0 Hz.
2. Resample to 20 Hz; filtering happens before resampling.
3. Remove 180 seconds from each edge.
4. Divide into complete 60-second windows, each 1,200 samples per channel.
5. Reject non-finite, flat, or extreme/corrupted windows.
6. Keep at most six windows per subject.
7. Extract nine channel-averaged features: log RMS, four spectral-band powers, spectral centroid, spectral entropy, line length, and zero-crossing rate.

Features are standardized using training data. MMD is calculated on these features, not directly on all raw waveform samples.

## What the five optimized parameters mean

The five values in `parameter_ranges` are normalized simulator strengths, not direct physiological measurements:

```json
"parameter_ranges": {
  "heart": [0.0, 1.0],
  "breathing": [0.0, 1.0],
  "fetal_movement": [0.0, 1.0],
  "muscle": [0.0, 1.0],
  "electrode_shift": [0.0, 1.0]
}
```

For each effect, 0 disables the effect and 1 applies the configured maximum effect. The optimizer searches decimal combinations in these bounds using SciPy differential evolution. It does not search heart rate in BPM or breathing rate in breaths/minute.

## Meaning of every physiology field

Every field below is currently used by `ehg_calibration/simulator.py`:

| Field | Units | Simulator role |
|---|---|---|
| `heart_bpm` | beats/minute | Random frequency of a shared cardiac contamination waveform |
| `breathing_bpm` | breaths/minute | Random frequency of low-frequency baseline modulation |
| `fetal_events_per_minute` | events/minute | Maximum Poisson rate of transient fetal-like events |
| `fetal_event_duration_seconds` | seconds | Duration range of each fetal transient |
| `muscle_bursts_per_minute` | bursts/minute | Maximum Poisson rate of muscle bursts |
| `muscle_burst_duration_seconds` | seconds | Duration range of each muscle burst |
| `max_electrode_gain_change` | unitless relative gain | Maximum electrode amplitude/gain change |
| `max_electrode_crosstalk` | unitless relative mixing | Maximum cross-channel mixing |
| `max_artifact_rms_ratio.heart` | artifact RMS / source RMS | Maximum cardiac artifact amplitude |
| `max_artifact_rms_ratio.breathing` | artifact RMS / source RMS | Maximum breathing artifact amplitude |
| `max_artifact_rms_ratio.fetal_movement` | artifact RMS / source RMS | Maximum fetal artifact amplitude |
| `max_artifact_rms_ratio.muscle` | artifact RMS / source RMS | Maximum muscle artifact amplitude |
| `max_artifact_rms_ratio.electrode_noise` | artifact RMS / source RMS | Maximum contact-noise amplitude |

RMS means root mean square signal amplitude. For a centered waveform it is a measure of typical signal strength. A ratio of 0.45 means the maximum artifact scale is 45% of the original channel RMS before the normalized optimizer strength is applied.

## Current configuration and sourcing status

The active `exploratory` profile in `configs/default.json` contains:

```json
"heart_bpm": [84.0, 90.0],
"breathing_bpm": [16.0, 16.0],
"fetal_events_per_minute": [0.0, 4.0],
"fetal_event_duration_seconds": [0.4, 2.5],
"muscle_bursts_per_minute": [0.0, 3.0],
"muscle_burst_duration_seconds": [0.5, 4.0],
"max_electrode_gain_change": 0.25,
"max_electrode_crosstalk": 0.15,
"max_artifact_rms_ratio": {
  "heart": 0.45,
  "breathing": 0.35,
  "fetal_movement": 0.55,
  "muscle": 0.65,
  "electrode_noise": 0.20
}
```

The heart range was set from the supplied research summary citing Bossung et al. 2023. The fixed breathing value was set from the supplied summary citing Al Zhranei et al. 2024; that source supports no meaningful posture scaling, not a seated-specific EHG artifact amplitude.

The remaining values are provisional engineering assumptions unless a source can be found that reports the same quantity and units. The supplied summary reports fetal-movement categories, qualitative muscle direction, and an electrode displacement of roughly 0.08 mV mean / 0.26 mV maximum from one Icelandic event. Those values cannot be inserted directly into the current event-rate, burst-rate, RMS-ratio, or gain fields without a defensible conversion.

## Literature research task

Find primary research evidence for posture-related changes in pregnant-person EHG and the artifacts represented by the five mechanisms. Prioritize studies with pregnant participants, explicit lying/supine versus sitting and/or standing comparisons, quantitative measurements, and compatible units.

For every proposed configuration value, return a table with:

1. Mechanism and exact JSON field.
2. Proposed lower and upper value.
3. Units and precise definition.
4. Population, pregnancy trimester, posture, sample size, and protocol.
5. Whether the value describes a physiological variable, an artifact, or an observation frequency.
6. Exact paper citation, DOI/PMID/PMCID, table/figure/page, and a link.
7. Any conversion required to map the source quantity to this simulator.
8. Whether the evidence supports a lying-to-seated difference, a lying-to-standing difference, or only a general physiological range.
9. Confidence level: directly measured, indirectly supported, or engineering assumption.

Do not convert these quantities without evidence:

- fetal movement percentages into EHG event rates;
- trunk or pelvic muscle activity into EHG RMS artifact ratios;
- electrode displacement in mV into relative gain/crosstalk/noise ratios;
- a general heart-rate range into a posture-specific EHG contamination amplitude.

If no compatible source exists, say so and recommend leaving the field as a clearly labelled assumption or changing the simulator so it uses a quantity that the literature actually measures. Do not invent a range, citation, DOI, or numerical conversion.

## Required output from the research assistant

Return:

1. An evidence table for all five mechanisms.
2. A revised `physiology` JSON block containing only values supported by the evidence, with provisional fields explicitly marked separately.
3. A mapping explanation for the normalized `[0, 1]` optimizer controls.
4. A list of fields that require new data or simulator redesign.
5. A recommended standing-posture sensitivity-analysis configuration, clearly labelled as a hypothesis rather than validated standing ground truth.
6. A short statement of which claims are safe to make from this unpaired MMD experiment and which claims are not.

The final goal is not merely to minimize MMD. It is to minimize MMD subject to physiologically defensible ranges, preserve the original EHG signal, and avoid interpreting the five fitted strengths as individually identified clinical measurements.
