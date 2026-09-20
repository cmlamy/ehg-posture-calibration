import { useEffect, useState } from 'react'
import { MECHANISM_IDS, MECHANISMS, type MechanismId } from '../lib/mechanisms'

type LiveExperimentModalProps = {
  open: boolean
  onClose: () => void
}

const FIELD =
  'w-full rounded-2xl border border-blush/70 bg-ivory px-3 py-2 text-sm text-ink outline-none focus:border-sage-deep'

export function LiveExperimentModal({ open, onClose }: LiveExperimentModalProps) {
  const [experiment, setExperiment] = useState('calibration')
  const [optimization, setOptimization] = useState('quick')
  const [validation, setValidation] = useState('nested-five-fold')
  const [fold, setFold] = useState('all')
  const [scenario, setScenario] = useState('standing-still')
  const [draws, setDraws] = useState('100')
  const [electrodeProfile, setElectrodeProfile] = useState('mixed')
  const [regularization, setRegularization] = useState(0.15)
  const [parameterMaximum, setParameterMaximum] = useState(1)
  const [heartRateMaximum, setHeartRateMaximum] = useState(1.3)
  const [enabled, setEnabled] = useState<Record<MechanismId, boolean>>(() =>
    Object.fromEntries(MECHANISM_IDS.map((id) => [id, true])) as Record<MechanismId, boolean>,
  )

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/35 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-test-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-cream p-6 shadow-2xl ring-1 ring-blush md:p-8"
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-sage-deep uppercase">
            Experiment controls
          </p>
          <h2 id="live-test-title" className="mt-2 font-display text-3xl text-ink">
            Live experiment settings
          </h2>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-charcoal/75">
            Experiment
            <select
              className={`${FIELD} mt-2`}
              value={experiment}
              onChange={(event) => setExperiment(event.currentTarget.value)}
            >
              <option value="calibration">Lying → sitting calibration</option>
              <option value="standing">Sitting → standing sensitivity</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Optimization
            <select
              className={`${FIELD} mt-2`}
              value={optimization}
              onChange={(event) => setOptimization(event.currentTarget.value)}
            >
              <option value="quick">Quick</option>
              <option value="full">Full</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Validation design
            <select
              className={`${FIELD} mt-2`}
              value={validation}
              onChange={(event) => setValidation(event.currentTarget.value)}
            >
              <option value="nested-five-fold">Five-fold nested CV</option>
              <option value="single-split">Train / validation / test split</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Calibration fold
            <select
              className={`${FIELD} mt-2`}
              value={fold}
              onChange={(event) => setFold(event.currentTarget.value)}
            >
              <option value="all">All folds</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>Fold {value}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Standing scenario
            <select
              className={`${FIELD} mt-2`}
              value={scenario}
              onChange={(event) => setScenario(event.currentTarget.value)}
            >
              <option value="standing-still">Standing still</option>
              <option value="sit-to-stand">Sit-to-stand transition</option>
              <option value="walking">Walking</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Simulation draws
            <select
              className={`${FIELD} mt-2`}
              value={draws}
              onChange={(event) => setDraws(event.currentTarget.value)}
            >
              <option value="25">25 — demo</option>
              <option value="100">100 — interactive</option>
              <option value="500">500 — research</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Electrode-event profile
            <select
              className={`${FIELD} mt-2`}
              value={electrodeProfile}
              onChange={(event) => setElectrodeProfile(event.currentTarget.value)}
            >
              <option value="quiet">Quiet rate</option>
              <option value="mixed">Quiet-to-movement range</option>
              <option value="movement">Movement-associated rate</option>
            </select>
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Preservation regularization · {regularization.toFixed(2)}
            <input
              className="mech-slider mt-4"
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={regularization}
              onChange={(event) => setRegularization(Number(event.currentTarget.value))}
            />
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Parameter upper bound · {parameterMaximum.toFixed(2)}
            <input
              className="mech-slider mt-4"
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={parameterMaximum}
              onChange={(event) => setParameterMaximum(Number(event.currentTarget.value))}
            />
          </label>

          <label className="text-sm font-medium text-charcoal/75">
            Maximum standing HR multiplier · {heartRateMaximum.toFixed(2)}×
            <input
              className="mech-slider mt-4"
              type="range"
              min={1}
              max={1.5}
              step={0.05}
              value={heartRateMaximum}
              onChange={(event) => setHeartRateMaximum(Number(event.currentTarget.value))}
            />
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-charcoal/75">Enabled mechanisms</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MECHANISM_IDS.map((id) => (
              <label
                key={id}
                className="flex items-center gap-3 rounded-2xl bg-ivory px-4 py-3 text-sm text-charcoal/75 ring-1 ring-blush/60"
              >
                <input
                  type="checkbox"
                  checked={enabled[id]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setEnabled((current) => ({ ...current, [id]: checked }))
                  }}
                  className="accent-sage-deep"
                />
                {MECHANISMS[id].name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-sage-deep px-5 py-2.5 text-sm font-medium text-cream"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  )
}
