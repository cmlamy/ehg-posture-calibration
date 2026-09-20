HEAD

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

# See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.



# ehg-posture-calibration

Schneider KT, Deckardt R. The implication of upright posture on pregnancy. J Perinat Med. 1991;19(1-2):121-31. doi: 10.1515/jpme.1991.19.1-2.121. PMID: 1870049.

Bossung V, Singer A, Ratz T, Rothenbühler M, Leeners B, Kimmich N. Changes in Heart Rate, Heart Rate Variability, Breathing Rate, and Skin Temperature throughout Pregnancy and the Impact of Emotions-A Longitudinal Evaluation Using a Sensor Bracelet. Sensors (Basel). 2023 Jul 23;23(14):6620. doi: 10.3390/s23146620. PMID: 37514915; PMCID: PMC10385491.

origin/main

