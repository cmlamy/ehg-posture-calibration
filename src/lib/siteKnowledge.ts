import { GROUPS } from './community'
import { LAYING_STATS, SEATING_STATS } from './datasets'
import { CLINICAL_WEIGHTS, FITTED_WEIGHTS, MECHANISMS, TARGET_WEIGHTS } from './mechanisms'
import { ACTIONS, DATASET_LABELS, LOG_ENTRIES } from './researchLog'

/** Compact snapshot of the whole instrument — Community, log, data, and fit. */
export function buildSiteCorpus(dayNotes: Record<string, string> = {}) {
  const groups = GROUPS.map(
    (g) =>
      `- ${g.name} | ${g.institution}, ${g.city}, ${g.country} | focus: ${g.focus.join(', ')} | contact: ${g.contact} <${g.email}> | ${g.summary}`,
  ).join('\n')

  const log = LOG_ENTRIES.map((e) => {
    const params = Object.entries(e.parameters)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    const metric = e.metric ? ` | ${e.metric.label} ${e.metric.value}` : ''
    return `- ${e.at.slice(0, 10)} | ${ACTIONS[e.action].label} | ${DATASET_LABELS[e.dataset]} | ${e.summary} | ${params} | ${e.result}${metric}${e.note ? ` | note: ${e.note}` : ''}`
  }).join('\n')

  const notes = Object.entries(dayNotes)
    .filter(([, text]) => text.trim())
    .map(([day, text]) => `- ${day}: ${text.trim()}`)
    .join('\n')

  const mechanisms = Object.values(MECHANISMS)
    .map((m) => `${m.name} (${m.color}${m.physiological ? ', physiology' : ', instrumentation'})`)
    .join('; ')

  return `VERA means Vertical EHG Response Adaptation. It is a research instrument for electrohysterogram (EHG) signals. It calibrates clinical laying recordings toward real-world seated EHG, then projects that seated mix into a standing range. Standing is always a band of simulated outcomes, never a single predicted line.

PAGES
- Home (/): posture graph, Fit sitting, Standing band, mechanism sliders.
- Data (/data): Seating and Laying datasets.
- Pipeline (/pipeline): filter → features → loudness → fit → validate → project.
- Validation (/validation): held-out Seating Half B.
- Community (/community): research groups, email, in-app messages.
- Research Log (/log): one report card per day; researcher notes live beside the recorded actions.
- Settings (/settings): display preferences.

DATASETS
- Seating: ${SEATING_STATS.description} Participants ${SEATING_STATS.participants}, clips ${SEATING_STATS.totalClips}, ${SEATING_STATS.channelConfig}, bandpass ${SEATING_STATS.bandpass}, ${SEATING_STATS.splitLabel} split, Half A ${SEATING_STATS.halfA.count} tuning, Half B ${SEATING_STATS.halfB.count} testing.
- Laying: ${LAYING_STATS.description} Participants ${LAYING_STATS.participants}, clips ${LAYING_STATS.totalClips}, contraction clips ${LAYING_STATS.contractionClips}, baseline clips ${LAYING_STATS.baselineClips}.

MECHANISMS
${mechanisms}
Clinical mix: heartbeat ${CLINICAL_WEIGHTS.heartbeat}, breathing ${CLINICAL_WEIGHTS.breathing}, muscle ${CLINICAL_WEIGHTS.muscle}, fetal ${CLINICAL_WEIGHTS.fetal}, electrode ${CLINICAL_WEIGHTS.electrode}.
Seated target: heartbeat ${TARGET_WEIGHTS.heartbeat}, breathing ${TARGET_WEIGHTS.breathing}, muscle ${TARGET_WEIGHTS.muscle}, fetal ${TARGET_WEIGHTS.fetal}, electrode ${TARGET_WEIGHTS.electrode}.
Fitted mix: heartbeat ${FITTED_WEIGHTS.heartbeat}, breathing ${FITTED_WEIGHTS.breathing}, muscle ${FITTED_WEIGHTS.muscle}, fetal ${FITTED_WEIGHTS.fetal}, electrode ${FITTED_WEIGHTS.electrode}.

BACKEND CALIBRATION (nested CV)
Raw MMD² 0.082, calibrated MMD² 0.058, about 30% relative reduction. Mean fitted strengths across folds: heartbeat 0.086, breathing 0.311, muscle 0.560, fetal 0.532, electrode 0.953.

COMMUNITY GROUPS
${groups}

RESEARCH LOG (recorded actions)
${log}

RESEARCHER DAY NOTES
${notes || '(none yet)'}
`
}

export function veraSystemPrompt(dayNotes: Record<string, string>) {
  return `You are the VERA guide on this research site. Answer using ONLY the site data below. Draw across Community, the research log, datasets, mechanisms, and the researcher's own day notes when the question needs more than one of them.

If someone wants a collaborator, university, country, product, wearable, belt, or topic, name the matching Community group, the person, their email, and why they fit. Never invent a contact or email. If nothing matches, say so and point them to /community.

Keep answers short and concrete. Prefer two or three sentences plus the contact line. Do not claim to search the open web.

SITE DATA
${buildSiteCorpus(dayNotes)}`
}
