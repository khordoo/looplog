type NavIconName = 'today' | 'exercises' | 'history' | 'settings'

export function NavIcon({ name, size = 21 }: { name: NavIconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
    {name === 'today' && <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.75h17M8.25 3v3.75M15.75 3v3.75" /><path d="m9.25 14.75 2 2 3.75-3.75" /></>}
    {name === 'exercises' && <><path d="M7.25 6.75v10.5M16.75 6.75v10.5" /><path d="M3.75 9.5v5M20.25 9.5v5" /><path d="M7.25 12h9.5" /></>}
    {name === 'history' && <><path d="M4.75 5.25v3.75h3.75" /><path d="M5.05 9.35a7.75 7.75 0 1 1-.55 4.9" /><path d="M12 8v4.25l2.85 1.7" /></>}
    {name === 'settings' && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
  </svg>
}
