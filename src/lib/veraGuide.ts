import { matchGroups, type ResearchGroup } from './community'

export type GuideLink = { label: string; to: string }

export type GuideEntry = {
  id: string
  questions: string[]
  answer: string
  links?: GuideLink[]
}

export const GUIDE: GuideEntry[] = [
  {
    id: 'what',
    questions: [
      'what is vera',
      'what does this site do',
      'what is this platform',
      'explain vera',
      'about',
    ],
    answer:
      'VERA — Vertical EHG Response Adaptation — is a research instrument for electrohysterogram (EHG) signals. It calibrates clinical laying recordings toward real-world seated EHG, then projects that seated mix into a standing range. The point is not a single predicted line — standing is always shown as a band of simulated outcomes.',
    links: [{ label: 'Open Home', to: '/' }],
  },
  {
    id: 'pages',
    questions: [
      'what pages are there',
      'how do i navigate',
      'where do i go',
      'site map',
      'what can i click',
    ],
    answer:
      'Home holds the posture graph, fit, and mechanism sliders. Data shows the Seating and Laying datasets. Pipeline walks the processing steps. Validation tests the fit on held-out participants. Research Log is one report card per day: all splits, thresholds, and results on the left, and a note you write yourself on the right. Community is where groups find and message each other. Settings covers display preferences.',
    links: [
      { label: 'Community', to: '/community' },
      { label: 'Data', to: '/data' },
    ],
  },
  {
    id: 'data',
    questions: [
      'what datasets',
      'seating',
      'laying',
      'icelandic',
      'tpehgt',
      'where does the data come from',
    ],
    answer:
      'There are two sources. Seating is real-world seated EHG, split by participant into Half A (tuning) and Half B (testing). Laying is the clinical contraction-labelled recording — the resting baseline the model starts from. No other datasets are used.',
    links: [{ label: 'Open Data', to: '/data' }],
  },
  {
    id: 'mechanisms',
    questions: [
      'what are the five mechanisms',
      'sliders',
      'heartbeat',
      'breathing',
      'muscle',
      'fetal',
      'electrode',
    ],
    answer:
      'Five signal mechanisms mix into every trace: maternal heartbeat (terracotta), breathing (sage), muscle noise (plum), fetal movement (mustard), and electrode signal (charcoal). The first four are physiology. Electrode is instrumentation. The sliders on Home change those mix weights.',
    links: [{ label: 'Open Home', to: '/' }],
  },
  {
    id: 'home',
    questions: [
      'how does home work',
      'sitting',
      'standing',
      'resting',
      'fit sitting',
      'how do i use the graph',
    ],
    answer:
      'Home starts on the laying recording. Sitting shows two lines — laying in stone, seated target in blush. Fit sitting morphs the laying line into the model. Standing fans that seated baseline into 64 simulated outcomes. Resting baseline returns you to the laying mix. The sliders ease between postures so you can watch the parameters move.',
    links: [{ label: 'Open Home', to: '/' }],
  },
  {
    id: 'distance',
    questions: [
      'signal distance',
      'mmd',
      'what does 0.354 mean',
      'match',
    ],
    answer:
      'Signal Distance is an MMD (maximum mean discrepancy) between your current mix and the seated target. Lower is closer. The compact card to the right of the Home graph tracks that value and a short history sparkline.',
    links: [{ label: 'Open Home', to: '/' }],
  },
  {
    id: 'pipeline',
    questions: [
      'what is the pipeline',
      'processing steps',
      'how does calibration work',
    ],
    answer:
      'The canonical path is: Data → filter (0.2–3 Hz, bipolar, 1-min clips) → eight spectral features → loudness correction → fit the five mechanisms → validate on Seating Half B → project seated to standing. Home is the fit and projection surface; Pipeline explains each step.',
    links: [{ label: 'Open Pipeline', to: '/pipeline' }],
  },
  {
    id: 'validation',
    questions: [
      'validation',
      'does it generalise',
      'half b',
    ],
    answer:
      'Validation tests the fitted mix on Seating Half B — participants held out from tuning. That is how VERA claims the sitting calibration is not just memorising Half A.',
    links: [{ label: 'Open Validation', to: '/validation' }],
  },
  {
    id: 'standing',
    questions: [
      'why a band',
      'standing range',
      'projection',
      'simulated outcomes',
    ],
    answer:
      'Standing EHG is not measured here, so VERA never draws a single standing line. Each of 64 outcomes samples literature ranges for heart rate, breathing depth, muscle tone, and fetal position. The band is the honest prediction.',
    links: [{ label: 'Open Home', to: '/' }],
  },
  {
    id: 'community',
    questions: [
      'community',
      'groups',
      'how do i contact someone',
      'email',
      'message',
      'networking',
      'who else works on this',
    ],
    answer:
      'Community is the directory of research groups on VERA. Ask me for a country, a university, or a topic — wearables, standing, EHG, MMD — and I will name the group, the person, and their email. Email opens your mail client. Message keeps a note on the Community page.',
    links: [{ label: 'Open Community', to: '/community' }],
  },
  {
    id: 'chat',
    questions: ['how does this chat work', 'are you ai', 'who are you'],
    answer:
      'I am the VERA guide. I answer from this site: pages, datasets, mechanisms, and the Community directory of groups and contacts. I do not search the web. Ask who works on a topic or in a country, or ask how a page works.',
    links: [{ label: 'Open Community', to: '/community' }],
  },
]

const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'do',
  'does',
  'what',
  'how',
  'where',
  'who',
  'to',
  'of',
  'and',
  'or',
  'in',
  'on',
  'for',
  'this',
  'that',
  'it',
  'me',
  'i',
  'please',
  'can',
  'you',
])

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
}

function formatGroup(group: ResearchGroup) {
  return `${group.institution} — ${group.name}\n${group.contact} · ${group.email}\n${group.focus.join(', ')}. ${group.summary}`
}

export function answerQuestion(raw: string): { answer: string; links: GuideLink[]; entryId: string | null } {
  const asked = tokens(raw)
  if (asked.length === 0) {
    return {
      entryId: null,
      links: [{ label: 'Community', to: '/community' }],
      answer:
        'Ask about VERA, the datasets, sitting versus standing, or who in Community works on a topic.',
    }
  }

  const groups = matchGroups(raw)
  if (groups.length > 0) {
    const intro =
      groups.length === 1
        ? 'Here is the Community group that matches.'
        : `Here are ${groups.length} Community groups that match.`
    const links: GuideLink[] = [
      { label: 'Open Community', to: '/community' },
      ...groups.map((group) => ({
        label: `Email ${group.contact.split(' ').slice(-1)[0]}`,
        to: `mailto:${group.email}?subject=${encodeURIComponent('VERA community — ' + group.name)}`,
      })),
    ]
    return {
      entryId: 'community-match',
      links,
      answer: `${intro}\n\n${groups.map(formatGroup).join('\n\n')}`,
    }
  }

  let best: GuideEntry | null = null
  let bestScore = 0
  for (const entry of GUIDE) {
    const hay = tokens(entry.questions.join(' ') + ' ' + entry.answer)
    let score = 0
    for (const word of asked) {
      if (hay.includes(word)) score += 2
      else if (hay.some((h) => h.startsWith(word) || word.startsWith(h))) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  if (!best || bestScore < 2) {
    return {
      entryId: null,
      links: [
        { label: 'Home', to: '/' },
        { label: 'Community', to: '/community' },
      ],
      answer:
        'I am not sure. Try asking what VERA is, who in the UK works on wearables, how sitting and standing work, or how to message a group in Community.',
    }
  }

  return { entryId: best.id, answer: best.answer, links: best.links ?? [] }
}
