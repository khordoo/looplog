import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Connectivity } from '../feedback/Connectivity'
import { UpdateNotice } from '../feedback/Connectivity'

export function Shell() {
  const location = useLocation()
  useEffect(() => {
    const titles: Array<[string, string]> = [['/today', 'Today'], ['/desk-reset', 'Desk reset'], ['/workout/', 'Active workout'], ['/sessions/', 'Session overview'], ['/exercises/', 'Exercise guide'], ['/exercises', 'Exercises'], ['/history/', 'Session details'], ['/history', 'History'], ['/settings/schedule', 'Schedule settings'], ['/settings/bands', 'Band settings'], ['/settings/substitutions', 'Substitution settings'], ['/settings/backups', 'Backup settings'], ['/settings/storage', 'Storage settings'], ['/settings/reset', 'Reset settings'], ['/settings', 'Settings'], ['/onboarding', 'Onboarding']]
    const title = titles.find(([path]) => location.pathname === path || location.pathname.startsWith(path))?.[1] ?? 'Training Tracker'
    document.title = `${title} · Training Tracker`
  }, [location.pathname])
  return <div className="app-shell" data-testid="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><div><p className="eyebrow">Private training log</p><h1>Training Tracker</h1></div><Connectivity /></header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    {!location.pathname.startsWith('/workout/') && <UpdateNotice />}
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/today">Today</NavLink><NavLink to="/exercises">Exercises</NavLink><NavLink to="/history">History</NavLink><NavLink to="/settings">Settings</NavLink>
    </nav>
  </div>
}
