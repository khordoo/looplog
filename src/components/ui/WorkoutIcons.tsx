type IconName = 'play' | 'steps' | 'mobility' | 'squat' | 'hinge' | 'shield' | 'sparkles' | 'clock' | 'check'

export function WorkoutIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
    {name === 'play' && <path d="m9 7 8 5-8 5Z" fill="currentColor" stroke="none" />}
    {name === 'steps' && <><path d="M8.2 3.5c1.7.5 2.6 2.8 2 5.1-.7 2.3-2.6 3.6-4.3 3.1-1.7-.5-2.5-2.8-1.9-5.1.7-2.3 2.5-3.7 4.2-3.1Z" /><path d="M15.8 12.3c1.7-.5 3.6.8 4.3 3.1.6 2.3-.2 4.6-1.9 5.1-1.7.5-3.6-.8-4.3-3.1-.6-2.3.2-4.6 1.9-5.1Z" /></>}
    {name === 'mobility' && <><path d="M4 12h16" /><path d="m7 9-3 3 3 3M17 9l3 3-3 3" /><circle cx="12" cy="6" r="2" /><path d="M12 8v9" /></>}
    {name === 'squat' && <><circle cx="12" cy="4.5" r="2" /><path d="m12 7-2.5 5 3 2.2M9.5 12l-4 2.5M12.5 14.2l4 3M5.5 14.5 4 20M16.5 17.2 20 20M9 9l5 1" /></>}
    {name === 'hinge' && <><circle cx="9" cy="4.5" r="2" /><path d="m9 7 4.5 4.5L18 13M13.5 11.5l-2 5.5M11.5 17 8 21M11.5 17l5 3M12 10l-6 1" /></>}
    {name === 'shield' && <><path d="M12 3 5.5 5.5v5.7c0 4.2 2.6 7.8 6.5 9.8 3.9-2 6.5-5.6 6.5-9.8V5.5Z" /><path d="m9 12 2 2 4-4" /></>}
    {name === 'sparkles' && <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z" /></>}
    {name === 'clock' && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>}
    {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>}
  </svg>
}
