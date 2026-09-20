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
