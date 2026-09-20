import { memo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts'
import { MECHANISMS, type MechanismId } from '../lib/mechanisms'
import { MechanismIcon } from './MechanismIcon'
import { SpringNumber } from './SpringNumber'

type Slice = { id: MechanismId; value: number }

type CompositionDonutProps = {
  data: Slice[]
  hovered: MechanismId | null
  onHover: (id: MechanismId | null) => void
}

function sliceId(entry: unknown): MechanismId | null {
  if (!entry || typeof entry !== 'object') return null
  if ('id' in entry) {
    const id = (entry as Slice).id
    if (id in MECHANISMS) return id
  }
  if ('payload' in entry) {
    return sliceId((entry as { payload: unknown }).payload)
  }
  return null
}

export const CompositionDonut = memo(function CompositionDonut({
  data,
  hovered,
  onHover,
}: CompositionDonutProps) {
  const focus = hovered ? data.find((d) => d.id === hovered) : null

  return (
    <div className="flex h-full flex-col justify-between rounded-3xl bg-cream/80 p-5 ring-1 ring-blush/80">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
          Signal composition
        </p>
        <p className="mt-1 font-display text-2xl text-ink">
          {focus ? MECHANISMS[focus.id].short : 'Five mechanisms'}
        </p>
        <p className="text-sm text-charcoal/70">
          {focus ? (
            <>
              <SpringNumber value={focus.value} decimals={1} suffix="%" /> of mix
            </>
          ) : (
            'Hover a segment'
          )}
        </p>
      </div>

      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="id"
              innerRadius={52}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={420}
              animationEasing="ease-out"
              stroke="#faf6f0"
              strokeWidth={3}
              onMouseEnter={(entry) => onHover(sliceId(entry))}
              onMouseLeave={() => onHover(null)}
              shape={(props) => {
                const id = sliceId(props.payload) ?? sliceId(props)
                const grow = id !== null && (props.isActive || hovered === id)
                return (
                  <Sector
                    cx={props.cx}
                    cy={props.cy}
                    innerRadius={props.innerRadius}
                    outerRadius={props.outerRadius + (grow ? 6 : 0)}
                    startAngle={props.startAngle}
                    endAngle={props.endAngle}
                    fill={id ? MECHANISMS[id].color : props.fill}
                    stroke="#faf6f0"
                    strokeWidth={3}
                    strokeDasharray={id ? MECHANISMS[id].dash || undefined : undefined}
                  />
                )
              }}
            >
              {data.map((slice) => (
                <Cell key={slice.id} fill={MECHANISMS[slice.id].color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="grid grid-cols-2 gap-2 text-sm">
        {data.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-full px-2 py-1 text-left text-charcoal"
              onMouseEnter={() => onHover(slice.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(slice.id)}
              onBlur={() => onHover(null)}
            >
              <MechanismIcon id={slice.id} className="h-4 w-4 shrink-0" />
              <span className="truncate">{MECHANISMS[slice.id].short}</span>
              <span className="ml-auto font-mono text-xs">
                <SpringNumber value={slice.value} decimals={0} suffix="%" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
})
