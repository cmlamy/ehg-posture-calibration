export type GroupFocus =
  | 'EHG'
  | 'Perinatal'
  | 'Signal processing'
  | 'Clinical'
  | 'Wearables'

export type ResearchGroup = {
  id: string
  name: string
  institution: string
  city: string
  country: string
  focus: GroupFocus[]
  contact: string
  email: string
  summary: string
}

export const GROUPS: ResearchGroup[] = [
  {
    id: 'reykjavik-ehg',
    name: 'Seated EHG Lab',
    institution: 'University of Iceland',
    city: 'Reykjavík',
    country: 'Iceland',
    focus: ['EHG', 'Wearables'],
    contact: 'Dr. Elín Jónsdóttir',
    email: 'elin.jonsdottir@hi.is',
    summary: 'Collects real-world seated abdominal recordings and maintains the Seating split used on Home.',
  },
  {
    id: 'ljubljana-clinical',
    name: 'Clinical Contraction Group',
    institution: 'University Medical Centre Ljubljana',
    city: 'Ljubljana',
    country: 'Slovenia',
    focus: ['EHG', 'Clinical'],
    contact: 'Prof. Andrej Pogačnik',
    email: 'andrej.pogacnik@kclj.si',
    summary: 'Stewards the laying, contraction-labelled clinical archive that VERA treats as the resting baseline.',
  },
  {
    id: 'oxford-posture',
    name: 'Postural Physiology Unit',
    institution: 'University of Oxford',
    city: 'Oxford',
    country: 'UK',
    focus: ['Perinatal', 'Clinical'],
    contact: 'Dr. Maya Okonkwo',
    email: 'maya.okonkwo@wrh.ox.ac.uk',
    summary: 'Publishes the heart-rate, tidal-volume and muscle-tone ranges behind the standing band.',
  },
  {
    id: 'edinburgh-belt',
    name: 'Maternal Wearable Studio',
    institution: 'University of Edinburgh',
    city: 'Edinburgh',
    country: 'UK',
    focus: ['Wearables', 'EHG'],
    contact: 'Dr. Fiona MacLeod',
    email: 'fiona.macleod@ed.ac.uk',
    summary:
      'Builds seated-to-standing abdominal belts and shares electrode-placement protocols — the wearable product side of VERA recordings.',
  },
  {
    id: 'tokyo-signal',
    name: 'Abdominal Signal Studio',
    institution: 'University of Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    focus: ['Signal processing', 'EHG'],
    contact: 'Dr. Haruka Mori',
    email: 'h.mori@t.u-tokyo.ac.jp',
    summary: 'Works on 0.2–3 Hz bipolar clipping and the eight-feature vector used before mechanism fitting.',
  },
  {
    id: 'montreal-mmd',
    name: 'Distribution Matching Lab',
    institution: 'McGill University',
    city: 'Montréal',
    country: 'Canada',
    focus: ['Signal processing'],
    contact: 'Dr. Léa Tremblay',
    email: 'lea.tremblay@mcgill.ca',
    summary: 'Develops MMD-style distances between clinical and seated feature clouds — the Signal Distance card.',
  },
  {
    id: 'cape-wearables',
    name: 'Ambulatory Perinatal Sensing',
    institution: 'University of Cape Town',
    city: 'Cape Town',
    country: 'South Africa',
    focus: ['Wearables', 'Perinatal'],
    contact: 'Dr. Sipho Ndlovu',
    email: 'sipho.ndlovu@uct.ac.za',
    summary: 'Designs belts that stay on from laying through standing, so electrode drift can be measured not guessed.',
  },
  {
    id: 'boston-fetal',
    name: 'Fetal Motion Observatory',
    institution: 'Boston Children’s Hospital',
    city: 'Boston',
    country: 'USA',
    focus: ['Perinatal', 'Clinical'],
    contact: 'Dr. Priya Raman',
    email: 'priya.raman@childrens.harvard.edu',
    summary: 'Annotates fetal-movement bursts on abdominal traces and shares labels with mechanism-fitting groups.',
  },
  {
    id: 'berlin-core',
    name: 'Core EMG & Orthostasis',
    institution: 'Charité — Universitätsmedizin',
    city: 'Berlin',
    country: 'Germany',
    focus: ['Clinical', 'Signal processing'],
    contact: 'Dr. Jonas Weber',
    email: 'jonas.weber@charite.de',
    summary: 'Measures how standing raises core EMG 15–35% — the muscle factor in VERA’s standing simulations.',
  },
]

export const FOCUS_OPTIONS: GroupFocus[] = [
  'EHG',
  'Perinatal',
  'Signal processing',
  'Clinical',
  'Wearables',
]

const COUNTRY_ALIASES: Record<string, string[]> = {
  UK: ['uk', 'united', 'kingdom', 'britain', 'british', 'england', 'scotland', 'wales'],
  USA: ['usa', 'america', 'american', 'states'],
  Iceland: ['iceland', 'icelandic', 'reykjavik'],
  Slovenia: ['slovenia', 'slovenian', 'ljubljana'],
  Japan: ['japan', 'japanese', 'tokyo'],
  Canada: ['canada', 'canadian', 'montreal', 'montréal'],
  'South Africa': ['africa', 'african', 'cape'],
  Germany: ['germany', 'german', 'berlin'],
}

const FOCUS_ALIASES: Record<GroupFocus, string[]> = {
  EHG: ['ehg', 'electrohysterogram', 'uterine', 'abdominal', 'signal'],
  Perinatal: ['perinatal', 'maternal', 'pregnancy', 'pregnant', 'fetal', 'standing', 'posture'],
  'Signal processing': ['signal', 'processing', 'filter', 'feature', 'mmd', 'calibration'],
  Clinical: ['clinical', 'hospital', 'contraction', 'laying'],
  Wearables: ['wearable', 'wearables', 'belt', 'sensor', 'product', 'device', 'hardware', 'ambulatory'],
}

function words(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function groupHaystack(group: ResearchGroup) {
  const extra = [
    ...(COUNTRY_ALIASES[group.country] ?? []),
    ...group.focus.flatMap((tag) => FOCUS_ALIASES[tag]),
  ]
  return words(
    `${group.name} ${group.institution} ${group.city} ${group.country} ${group.contact} ${group.summary} ${group.focus.join(' ')} ${extra.join(' ')}`,
  )
}

/** Rank Community groups for a free-text research question. */
export function matchGroups(query: string, limit = 3): ResearchGroup[] {
  const asked = words(query).filter(
    (w) =>
      ![
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
        'someone',
        'somebody',
        'about',
        'with',
        'from',
        'want',
        'need',
        'looking',
        'find',
        'research',
        'collaborate',
        'collaboration',
        'certain',
        'some',
      ].includes(w),
  )
  if (asked.length === 0) return []

  const countries = Object.entries(COUNTRY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => asked.includes(alias)))
    .map(([country]) => country)

  let ranked = GROUPS.map((group) => {
    const hay = groupHaystack(group)
    let score = 0
    for (const word of asked) {
      if (hay.includes(word)) score += 3
      else if (hay.some((h) => h.startsWith(word) || word.startsWith(h))) score += 1
    }
    if (countries.includes(group.country)) score += 4
    return { group, score }
  })
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score)

  if (countries.length > 0 && ranked.some((row) => countries.includes(row.group.country))) {
    ranked = ranked.filter((row) => countries.includes(row.group.country))
  }

  return ranked.slice(0, limit).map((row) => row.group)
}
