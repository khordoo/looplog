import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Status } from '../../components/ui/Status'
import { APPEARANCE_CHANGE_EVENT, applyAppearance, readAppearancePreference, resolvedAppearance, saveAppearancePreference, type AppearancePreference } from '../../lib/theme'

const choices: Array<{ value: AppearancePreference; title: string; description: string }> = [
  { value: 'system', title: 'System', description: 'Follow your device appearance automatically.' },
  { value: 'light', title: 'Light', description: 'A bright canvas for daytime training.' },
  { value: 'dark', title: 'Dark', description: 'A low-glare canvas for evening training.' },
]

export function AppearanceSettings() {
  const [preference, setPreference] = useState<AppearancePreference>(() => readAppearancePreference())
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolvedAppearance(readAppearancePreference()))
  const [message, setMessage] = useState('')

  useEffect(() => {
    applyAppearance(preference)
    const onAppearanceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ resolved?: 'light' | 'dark' }>).detail
      if (detail?.resolved) setResolved(detail.resolved)
    }
    document.addEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange)
    return () => document.removeEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange)
  }, [preference])

  function choose(next: AppearancePreference) {
    setPreference(next)
    saveAppearancePreference(next)
    setMessage(`${choices.find((choice) => choice.value === next)?.title ?? 'System'} appearance saved.`)
  }

  return <div className="page narrow appearance-page">
    <Link to="/settings" className="text-button">← Settings</Link>
    <p className="eyebrow">Make LoopLog fit your day</p>
    <h2>Appearance</h2>
    <Card>
      <h3>Theme</h3>
      <p className="muted">Choose how LoopLog looks. System is the default and follows your device in real time.</p>
      <div className="appearance-choice-list" role="radiogroup" aria-label="Appearance theme">
        {choices.map((choice) => <label className={`appearance-choice${preference === choice.value ? ' selected' : ''}`} key={choice.value}>
          <input className="appearance-choice-input" type="radio" name="appearance" value={choice.value} checked={preference === choice.value} onChange={() => choose(choice.value)} data-testid={`appearance-${choice.value}`} />
          <span className="appearance-choice-icon" aria-hidden="true">{choice.value === 'system' ? '◐' : choice.value === 'light' ? '☼' : '☾'}</span>
          <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
          <span className="appearance-check" aria-hidden="true">{preference === choice.value ? '✓' : ''}</span>
        </label>)}
      </div>
      <p className="appearance-status" data-testid="appearance-status">Currently showing <strong>{resolved}</strong> colors.</p>
      {message && <Status kind="success">{message}</Status>}
      <div className="form-actions"><Button variant="ghost" onClick={() => choose('system')} data-testid="appearance-reset">Use system default</Button></div>
    </Card>
  </div>
}
