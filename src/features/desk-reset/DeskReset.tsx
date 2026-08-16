import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deskReset } from '../../content/plans'
import { exerciseById } from '../../lib/content'
import { Button, Card, Status } from '../../components/ui/Status'

const TOTAL_SECONDS = deskReset.durationMinutes * 60
const SECONDS_PER_MOVEMENT = 60

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function DeskReset() {
  const movements = useMemo(() => deskReset.items.map((id) => exerciseById(id)).filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise)), [])
  const [remaining, setRemaining] = useState(TOTAL_SECONDS)
  const [running, setRunning] = useState(false)
  const elapsed = TOTAL_SECONDS - remaining
  const activeIndex = Math.min(movements.length - 1, Math.floor(elapsed / SECONDS_PER_MOVEMENT))
  const active = movements[activeIndex]

  useEffect(() => {
    if (!running || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) { setRunning(false); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [remaining, running])

  function nextMovement() {
    const next = Math.min(TOTAL_SECONDS, (activeIndex + 1) * SECONDS_PER_MOVEMENT)
    setRemaining(Math.max(0, TOTAL_SECONDS - next))
  }

  function reset() {
    setRunning(false)
    setRemaining(TOTAL_SECONDS)
  }

  return <div className="page narrow desk-reset-page">
    <p className="eyebrow">Optional movement break</p>
    <h2>Five-minute desk reset</h2>
    <Status kind="info">This reset is optional and never changes your workout rotation, history, or progression recommendations.</Status>
    <Card className="desk-reset-now">
      <div className="page-heading"><div><p className="eyebrow">Minute {Math.min(5, activeIndex + 1)} of 5</p><h3>{remaining === 0 ? 'Reset complete' : active?.name}</h3></div><strong className="reset-clock" aria-live="polite" data-testid="desk-reset-timer">{clock(remaining)}</strong></div>
      {remaining === 0 ? <p>Nice work. Return to your day, or reset the timer whenever you want another gentle movement break.</p> : active ? <><p><strong>Setup:</strong> {active.setup.join(' ')}</p><ol>{active.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><strong>Breathing and tempo:</strong> {active.breathingTempo}</p></> : <p>Written guidance is unavailable.</p>}
      <div className="form-actions"><Button onClick={() => setRunning((value) => !value)} disabled={remaining === 0}>{running ? 'Pause' : remaining === TOTAL_SECONDS ? 'Start five-minute reset' : 'Resume'}</Button><Button variant="secondary" onClick={nextMovement} disabled={remaining === 0 || activeIndex >= movements.length - 1}>Next movement</Button><Button variant="ghost" onClick={reset}>Reset timer</Button></div>
    </Card>
    <Card><h3>Five one-minute movements</h3><ol className="reset-list">{movements.map((exercise, index) => <li key={exercise.id} aria-current={index === activeIndex && remaining > 0 ? 'step' : undefined}><strong>{exercise.name}</strong><span>{exercise.formCues.slice(0, 2).join(' · ')}</span><Link to={`/exercises/${exercise.id}`}>Full written guide and demonstration</Link></li>)}</ol></Card>
  </div>
}
