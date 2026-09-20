import { N_SIMS } from '../lib/projection'
import { UI } from '../lib/palette'

type SimulationControlsProps = {
  running: boolean
  onToggle: () => void
  showBand: boolean
  onToggleBand: () => void
  onReseed?: () => void
  seed?: number
  /** Seed, resample and band only apply once outcomes are being simulated. */
  simulationActive?: boolean
  showSeed?: boolean
  /** Sitting comparison: morph the laying line into the fitted model. */
  fitAvailable?: boolean
  fitted?: boolean
  onFit?: () => void
}

const PILL =
  'rounded-full bg-cream px-4 py-2 text-sm font-medium text-charcoal/70 ring-1 ring-blush/60 transition-colors enabled:hover:bg-blush/30 enabled:hover:text-ink disabled:opacity-40'

export function SimulationControls({
  running,
  onToggle,
  showBand,
  onToggleBand,
  onReseed,
  seed,
  simulationActive = true,
  showSeed = true,
  fitAvailable = false,
  fitted = false,
  onFit,
}: SimulationControlsProps) {
  if (fitAvailable) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="fit-sitting"
          onClick={onFit}
          aria-pressed={fitted}
          className="rounded-full px-4 py-2 text-sm font-medium text-cream"
          style={{ background: fitted ? UI.charcoal : UI.sageDeep }}
        >
          {fitted ? '↺ Reset laying' : 'Fit sitting'}
        </button>
      </div>
    )
  }

  if (!simulationActive) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showSeed && seed !== undefined && (
        <div className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-blush/60">
          <span className="text-charcoal/50">Seed</span>
          <span className="font-mono font-semibold text-ink">{seed}</span>
        </div>
      )}
      <button id="reseed-simulation" onClick={onReseed} className={PILL}>
        ↺ New sample
      </button>
      <button
        id="toggle-animation"
        onClick={onToggle}
        className="rounded-full px-4 py-2 text-sm font-medium text-cream"
        style={{ background: running ? UI.sageDeep : UI.charcoal }}
      >
        {running ? '⏸ Pause' : '▶ Animate'}
      </button>
      <button
        id="toggle-band"
        onClick={onToggleBand}
        aria-pressed={showBand}
        className={PILL}
      >
        {showBand ? '◫ Hide band' : '◫ Show band'}
      </button>
      <span className="text-xs text-charcoal/40">{N_SIMS} simulated outcomes</span>
    </div>
  )
}
