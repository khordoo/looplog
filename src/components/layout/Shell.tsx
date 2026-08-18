import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Connectivity } from '../feedback/Connectivity'
import { UpdateNotice } from '../feedback/Connectivity'
import { NavIcon } from '../ui/NavIcon'

export function Shell() {
  const location = useLocation()
  useEffect(() => {
    const titles: Array<[string, string]> = [['/today', 'Today'], ['/desk-reset', 'Desk reset'], ['/workout/', 'Active workout'], ['/sessions/', 'Session overview'], ['/exercises/', 'Exercise guide'], ['/exercises', 'Exercises'], ['/history/', 'Session details'], ['/history', 'History'], ['/settings/appearance', 'Appearance settings'], ['/settings/schedule', 'Schedule settings'], ['/settings/bands', 'Band settings'], ['/settings/substitutions', 'Substitution settings'], ['/settings/backups', 'Backup settings'], ['/settings/storage', 'Storage settings'], ['/settings/reset', 'Reset settings'], ['/settings', 'Settings'], ['/onboarding', 'Onboarding']]
    const title = titles.find(([path]) => location.pathname === path || location.pathname.startsWith(path))?.[1] ?? 'LoopLog'
    document.title = `${title} · LoopLog`
  }, [location.pathname])
  return <div className="app-shell" data-testid="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><div className="app-header-inner"><div><p className="eyebrow">Private training log</p><h1>LoopLog</h1></div><Connectivity /></div></header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    {!location.pathname.startsWith('/workout/') && <UpdateNotice />}
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/today"><NavIcon name="today" /><span>Today</span></NavLink><NavLink to="/exercises"><NavIcon name="exercises" /><span>Exercises</span></NavLink><NavLink to="/history"><NavIcon name="history" /><span>History</span></NavLink><NavLink to="/settings"><NavIcon name="settings" /><span>Settings</span></NavLink>
    </nav>
  </div>
}
