# Research Platform UI/UX — Build Prompt

## 0. TECHNICAL & MOTION CONTRACT (read this before anything else)

This is a **functional prototype**, not a static mockup. Build it in **React (Vite or Next.js) + Tailwind CSS + Framer Motion**. Do not simulate motion with plain CSS `transition`/`animation` alone — it reads as flat and mechanical. Use:

- **Framer Motion** for all layout transitions, card entrances, pipeline stage illumination, and drawer/expand interactions. Use spring configs (`type: "spring", stiffness: ~120-180, damping: ~14-20`) so things have a tiny bit of overshoot/settle — that subtle "give" is what makes motion feel organic instead of robotic.
- **Animated SVG paths** for every waveform. Waveforms redraw via interpolated path data (or Canvas/`requestAnimationFrame` if performance demands it) — never a static image or a single CSS keyframe loop. When a slider moves, the path must visibly and immediately morph, not fade or snap.
- **Tweened/spring numbers** for every changing metric (MMD value, slider percentages, feature values) — use a `useSpring`/`useMotionValue` counter so numbers visibly count up/down, never `setState` snapping a raw number.
- **Live state wiring**: all four mechanism sliders write to shared state that simultaneously drives — in the same render tick — the mechanism's own mini-waveform, the combined waveform, the donut chart, the MMD value, and the MMD sparkline. No component should update out of sync with another.
- **Recharts** (or D3 if you want more control) for the donut chart, with `isAnimationActive` and eased transitions on data change — never a chart that hard-cuts to new values.

**Motion budget — non-negotiable minimums:**
- Slider drag → mechanism waveform redraw: **<100ms**, visibly fluid, not discrete steps.
- Combined waveform morph: continuous, never a hard cut between states.
- Page/section entrances: staggered fade+slide, ~40-80ms stagger per element, never everything popping in at once.
- Pipeline stage completion: a glow/illuminate transition, not an instant color swap.
- Idle state: the calibrated waveform should have a subtle continuous idle animation (slow drift/breathing) even when nothing is being dragged — the product should never look frozen.

**Priority rule if time/effort is constrained:** the **Step 8 hero calibration screen** (Section 4 below) is the single most important surface in this product — it is the selling point. If forced to choose between deep interactivity there versus polish everywhere else, **always prioritize Step 8**. Every other page can be simpler, but Step 8 cannot.

---

## 1. WHAT THIS IS

A research platform for calibrating clinical EHG (electrohysterogram) signals against real-world physiological data, so they better reflect real conditions. It should feel like:

> "An elegant scientific instrument" — not a data dashboard, not hospital software, not a generic AI tool.

First impression: *"This is beautiful and simple."*
Second impression: *"Oh — this is actually a sophisticated scientific system."*

**Only two data sources exist. Do not introduce others:**
1. **Icelandic** — seated EHG, real-world, split by participant into Half A (tuning) / Half B (testing)
2. **TPEHGT** — clinical EHG, contraction-labelled

**Four physiological mechanisms being modeled** (fixed color identities — keep consistent everywhere):
| Mechanism | Color |
|---|---|
| Maternal heartbeat | Dusty terracotta |
| Breathing | Muted sage |
| Muscle noise | Muted plum |
| Fetal movement | Warm mustard |
| Electrode/EHG signal (baseline) | Charcoal |

**Canonical pipeline** (state this once, reuse everywhere — don't re-describe it three different ways):
`Data (Icelandic + TPEHGT) → Signal processing/filtering (0.2–3Hz, bipolar channels, 1-min clips) → 8 spectral features → Loudness correction → Fit 4 mechanisms (calibration) → Validate on Icelandic Half B → Project seated→standing`

---

## 2. VISUAL SYSTEM

**Palette** (no blue as primary, no neon, accessible to color-vision deficiency):
- Background: warm ivory/cream
- Secondary: soft blush pink
- Accent: muted sage/olive
- Supporting: dusty terracotta, muted plum, warm mustard, charcoal

Never rely on color alone for meaning — pair every color-coded element with a label, icon, line style, or shape. No red/green as the sole good/bad signal.

**Typography**: elegant editorial system. Large confident titles, medium section headers, small metadata. Short declarative labels over paragraphs — e.g. "MATCH THE SIGNAL" not "Here we use the MMD optimization procedure to...". Let visuals carry explanation; text supports, doesn't lecture.

**Layout discipline**: whitespace-heavy, one idea per screen, one idea per chart. No 15-card dashboards, no walls of data, no giant paragraphs, no tiny text. Progressive disclosure — a researcher understands the whole product in ~10 seconds from the pipeline alone; everything else expands on demand.

Use the uploaded moodboard (cream/blush/sage editorial aesthetic, organic shapes, rounded containers, generous whitespace) as the tonal reference only — translate it into a scientific instrument, not a pregnancy/doula site.

---

## 3. NAVIGATION

Minimal sidebar only: **Home · Data · Calibration · Validation · Projection · Research Log · Settings**. Nothing else.

---

## 4. ★ THE HERO SCREEN — "Find the Signal" (build this first, build it deepest)

Title: **"Find the signal"**
Subtitle: "Fit four physiological mechanisms to bring the clinical signal closer to real-world seated EHG."

**Center**: one large, continuously animating calibrated EHG waveform (idle drift even at rest).

**Four mechanism streams** flow visually into the combined signal (individual animated traces converging downward/inward into the combined waveform — this convergence should itself be animated, not just implied by layout).

**Four large tactile sliders** (not tiny dashboard inputs — big, touch-friendly, with the mechanism's own mini-waveform and icon inline):
- ♡ Maternal Heartbeat
- Breathing
- Muscle Noise
- Fetal Movement

Dragging any slider, in real time and in sync:
1. redraws that mechanism's mini-waveform
2. morphs the combined waveform
3. updates the 8-feature representation
4. tweens the MMD value
5. animates the donut chart segments

**Donut chart** ("Signal composition") sits near the sliders, visually lightweight, live-updating. Hover a segment → highlight it, show name + %, subtly emphasize the matching slider. Accessible pattern/icon per segment, not color-only.

**MMD ("Signal Distance")**: prominent but simple — big number that tweens on change, small animated trend arrow, tiny sparkline of iteration history, one-line caption ("Lower means closer to the target distribution.").

**Three-panel comparison** (Clinical → Calibrated → Icelandic Target): small waveform panels, dead simple, communicates "started here / made this / aiming for this" at a glance.

---

## 5. OTHER SCREENS (secondary — keep simple, expand-on-click only)

- **Home/Dashboard**: "Signal Calibration" title, horizontal stage progress (Data→Signal→Calibration→Validation→Projection, only current stage emphasized), then the hero calibration module from Section 4.
- **Data**: two cards only (Icelandic, TPEHGT), each with a tiny animated waveform, opens a detail drawer on click — not a new page. Icelandic split shown via participant silhouettes, split by woman into Half A (tuning)/Half B (testing) — visually make clear the split is participant-level, not clip-level.
- **Pipeline**: vertical story, numbered steps 01–11, large minimal blocks that expand on click to reveal a short explanation + relevant mechanism icons/mini-animation. Step 7 (Loudness Correction) is explicitly framed as an equipment correction, not a slider: TPEHGT → dataset ratio → corrected signal.
- **Validation**: "Does it hold up?" — three collapsed sections (Distribution similarity / Biological plausibility / Contraction detection), key result shown first, detail on expand.
- **Projection**: "From seated to standing" — seated baseline → literature ranges → 50–100 simulated outcomes → standing range, shown as an animated uncertainty band (never a single predicted line).
- **Research Log**: vertical timestamped timeline (lab-notebook feel). Each entry: timestamp, action, dataset, parameters, result. Filterable by dataset/action, expandable entries, exportable.
- **Processing/loading states**: always signal-themed, never generic spinners — e.g. four streams gradually converging for "Fitting physiological mechanisms...", a trace crossing a checkpoint marker for "Validating on Half B...".

---

## 6. HARD RULES

No blue-primary UI · no 15-card dashboards · no medical/hospital visual language · no neon · no excessive gradients · no tiny text · no giant paragraphs · no chart that doesn't communicate exactly one idea · every mechanism keeps its assigned color everywhere · color is never the only signal of meaning · use realistic placeholder data throughout and make every interaction actually functional, not decorative.
