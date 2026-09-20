# EHG standing projection sensitivity report

> Status: **projected, not validated**. No measured standing pregnancy EHG was used. Intervals describe simulations conditional on the stated assumptions; they are not clinical confidence intervals.

Scenario: `standing_still`  
Simulation draws: 500  
Held-out source subjects: 40  
Source windows per draw: 240

## Projected outcomes

- `envelope_correlation_with_target_calibrated`: median 0.900173, projected 95% interval [0.870328, 0.927851]
- `envelope_correlation_with_original`: median 0.747412, projected 95% interval [0.720019, 0.770422]
- `interchannel_correlation_mean_absolute_change`: median 0.067978, projected 95% interval [0.052892, 0.086187]
- `rms_ratio_to_target_calibrated`: median 1.073899, projected 95% interval [1.053608, 1.099762]
- `spectral_centroid_shift_hz`: median 0.005734, projected 95% interval [0.003424, 0.008269]
- `spectral_entropy_change`: median 0.008817, projected 95% interval [0.006467, 0.011698]
- `realized_standing_artifact_rms_ratio`: median 0.297894, projected 95% interval [0.246654, 0.352559]

## Strongest simulator sensitivity driver per outcome

- `envelope_correlation_with_target_calibrated`: `mean_jump_amplitude_ratio` (Spearman rho -0.725)
- `envelope_correlation_with_original`: `mean_jump_amplitude_ratio` (Spearman rho -0.684)
- `interchannel_correlation_mean_absolute_change`: `mean_jump_amplitude_ratio` (Spearman rho 0.777)
- `rms_ratio_to_target_calibrated`: `mean_jump_amplitude_ratio` (Spearman rho 0.779)
- `spectral_centroid_shift_hz`: `event_count` (Spearman rho 0.569)
- `spectral_entropy_change`: `event_count` (Spearman rho 0.724)
- `realized_standing_artifact_rms_ratio`: `mean_jump_amplitude_ratio` (Spearman rho 0.861)

## Training-only target event evidence

### Calibration fold 1

- Quiet detected-event rate: 48.542/hour
- Movement-associated detected-event rate: 104.396/hour
- Movement/quiet detected-rate enrichment: 2.151x
- Detected events: 3049
- Position-associated detected events: 3
- Transition morphology source: `position_change_associated`

### Calibration fold 2

- Quiet detected-event rate: 56.076/hour
- Movement-associated detected-event rate: 128.435/hour
- Movement/quiet detected-rate enrichment: 2.290x
- Detected events: 3431
- Position-associated detected events: 5
- Transition morphology source: `position_change_associated`

### Calibration fold 3

- Quiet detected-event rate: 55.811/hour
- Movement-associated detected-event rate: 92.158/hour
- Movement/quiet detected-rate enrichment: 1.651x
- Detected events: 3041
- Position-associated detected events: 6
- Transition morphology source: `position_change_associated`

### Calibration fold 4

- Quiet detected-event rate: 58.290/hour
- Movement-associated detected-event rate: 119.778/hour
- Movement/quiet detected-rate enrichment: 2.055x
- Detected events: 3692
- Position-associated detected events: 2
- Transition morphology source: `position_change_associated`

### Calibration fold 5

- Quiet detected-event rate: 49.065/hour
- Movement-associated detected-event rate: 133.579/hour
- Movement/quiet detected-rate enrichment: 2.722x
- Detected events: 2865
- Position-associated detected events: 6
- Transition morphology source: `position_change_associated`

These observations come only from target training women. Translating them into standing scenarios is a hypothesis, not a standing measurement.

## Contraction detector AUC

Unavailable: Projected held-out source windows do not provide aligned, independently verified contraction labels. No pseudo-label AUC was fabricated.

The demo envelope band is pointwise: at each time point it contains the central 95% of simulated values. It is not a simultaneous confidence band.
