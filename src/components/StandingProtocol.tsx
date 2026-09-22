import { MechanismIcon } from './MechanismIcon'
import { UI } from '../lib/palette'
import { seatedWindowCaption } from '../lib/lyingWindow'
import { standingTestCards } from '../lib/standingRanges'

function WalkingMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        fill="none"
        stroke={UI.stone}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8M8 8.2 6.4 12.5 4.8 15.2M8 8.2 11.2 10l-1 4.6 3.4 3.2M11.2 10 14.8 8.6 16.6 12"
      />
    </svg>
  )
}

export function StandingProtocol() {
  const cards = standingTestCards()

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
          Add on a seated recording
        </p>
        <p className="mt-2 font-mono text-sm text-ink">{seatedWindowCaption()}</p>
        <p className="mt-1 max-w-2xl text-sm text-charcoal/65">
          Start testing from these ranges. Projected, not validated.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-3xl bg-cream/80 p-5 ring-1 ring-blush/80"
            >
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory"
                  aria-hidden="true"
                >
                  {card.id === 'walking' ? (
                    <WalkingMark />
                  ) : (
                    <MechanismIcon id={card.id} className="h-6 w-6" />
                  )}
                </span>
                <p className="font-display text-lg leading-tight text-ink">
                  {card.id === 'heartbeat' ? '♡ ' : ''}
                  {card.name}
                </p>
              </div>
              <p className="text-xs leading-snug text-ink">{card.test}</p>
              <p className="mt-1 text-xs leading-snug text-charcoal/55">
                {card.detail}
              </p>
            </div>
        ))}
      </div>
    </div>
  )
}
