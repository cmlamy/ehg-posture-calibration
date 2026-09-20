import { MECHANISMS, type MechanismId } from '../lib/mechanisms'

type IconProps = { id: MechanismId; className?: string }

export function MechanismIcon({ id, className = 'h-5 w-5' }: IconProps) {
  const color = MECHANISMS[id].color
  if (id === 'heartbeat') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill={color}
          d="M12 20s-7-4.4-9.2-8.2C1.2 9 2.4 5.8 5.4 5.2 7.3 4.8 9 5.7 12 8.2c3-2.5 4.7-3.4 6.6-3 3 .6 4.2 3.8 2.6 6.6C19 15.6 12 20 12 20z"
        />
      </svg>
    )
  }
  if (id === 'breathing') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M4 14c2-6 4-6 6 0s4 6 6 0 4-6 6 0"
        />
      </svg>
    )
  }
  if (id === 'muscle') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          d="M5 15c2-1 3-5 7-5s5 4 7 5M8 10c.5-2 2-3.5 4-3.5S15.5 8 16 10"
        />
      </svg>
    )
  }
  if (id === 'electrode') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="10.5" cy="14" r="5.2" fill="none" stroke={color} strokeWidth="1.8" />
        <circle cx="10.5" cy="14" r="1.7" fill={color} />
        <path
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.5 10.2L19.5 5.2M15.8 4.8h4v4"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="9" r="3.2" fill={color} />
      <path
        fill={color}
        d="M7 19c.4-3 2.4-4.5 5-4.5s4.6 1.5 5 4.5"
      />
    </svg>
  )
}
