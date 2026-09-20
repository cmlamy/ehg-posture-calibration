# Nested subject-level cross-validation report


> EHGDB is not posture-controlled seated ground truth. These results measure calibration to the Icelandic recording domain, not specifically to seated posture.

Outer folds: 5. Every subject appears in exactly one outer test fold, and each fold selects its model using only that fold's inner training and validation subjects.

## Aggregate held-out performance

- Raw MMD²: 0.082401
- Calibrated MMD²: 0.057737
- MMD² reduction: 0.024664 (29.9%)
- Subject-bootstrap 95% CI for MMD² reduction: [0.014912, 0.034267]
- Raw MMD: 0.284070
- Calibrated MMD: 0.237450
- MMD reduction: 0.046620 (16.4%)
- Subject-bootstrap 95% CI for MMD reduction: [0.022494, 0.052084]
- Mean raw domain AUC: 0.7135416666666666
- Mean calibrated domain AUC: 0.6188368055555555
- Mean preservation penalty: 0.000114
- Mean achieved artifact/source RMS ratio: 0.457308

## Outer-fold results

- Fold 1: MMD² 0.050380 -> 0.036938; reduction 0.013442
- Fold 2: MMD² 0.093789 -> 0.069627; reduction 0.024163
- Fold 3: MMD² 0.078141 -> 0.051000; reduction 0.027142
- Fold 4: MMD² 0.120665 -> 0.086488; reduction 0.034177
- Fold 5: MMD² 0.069031 -> 0.044634; reduction 0.024397

## Selected-parameter stability

- heart: mean 0.0862, SD 0.0386, range [0.0198, 0.1191]
- breathing: mean 0.3111, SD 0.2967, range [0.0377, 0.7408]
- fetal_movement: mean 0.5322, SD 0.3187, range [0.0461, 0.8525]
- muscle: mean 0.5604, SD 0.3063, range [0.1764, 0.9161]
- electrode_shift: mean 0.9526, SD 0.0250, range [0.9198, 0.9782]

The aggregate is a cross-validated generalization estimate, not the result of one final fitted model. A confidence interval crossing zero does not establish a reliable average reduction. Do not tune settings against these outer-test results and continue to call them untouched.
