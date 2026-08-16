/* eslint-disable react-refresh/only-export-components -- pure reminder helpers are exported for boundary tests */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resolveSchedule } from '../../domain/schedule'
import { summarizeWorkout, type WorkoutSummary } from '../../domain/summaries'
import type { AppMeta, Profile, SetLog, WorkoutSession } from '../../domain/types'
import { useStorage } from '../../app/providers/AppProvider'
import { plan } from '../../lib/content'
import { newId, nowIso } from '../../lib/ids'
import { Button, Card, Status } from '../../components/ui/Status'

function readableDate(value?: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'when you are ready'
}

/** Backup is due after the first completion, seven days, or five more completions. */
export function isBackupReminderDue(sessions: WorkoutSession[], meta?: AppMeta, now = new Date()): boolean {
  const completed = sessions.filter((session) => session.status === 'completed')
  if (!completed.length) return false
  if (!meta?.lastSuccessfulExportAt) return true
  const exportedAt = new Date(meta.lastSuccessfulExportAt)
  if (Number.isNaN(exportedAt.getTime())) return true
  const additional = completed.filter((session) => {
    const when = new Date(session.completedAt ?? session.updatedAt)
    return when > exportedAt
  }).length
  return now.getTime() - exportedAt.getTime() >= 7 * 24 * 60 * 60 * 1000 || additional >= 5
}

export function recoveryLabel(summary?: WorkoutSummary): string {
  if (!summary) return 'No completed workout yet'
  return `Workout ${summary.workoutKey} on ${readableDate(summary.scheduledDate)} · ${summary.setsCompleted} sets completed`
}

export function Today() {
  const storage = useStorage()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile>()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [appMeta, setAppMeta] = useState<AppMeta>()
  const [priorSummary, setPriorSummary] = useState<WorkoutSummary>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [nextProfile, nextSessions, nextMeta] = await Promise.all([storage.getProfile(), storage.listSessions(), storage.getAppMeta()])
    setProfile(nextProfile); setSessions(nextSessions); setAppMeta(nextMeta)
    const latest = nextSessions.filter((session) => session.status === 'completed').sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))[0]
    if (latest) {
      const logs = await storage.getExerciseLogs(latest.id)
      const allSets: SetLog[] = []
      for (const log of logs) allSets.push(...await storage.getSetLogs(log.id))
      setPriorSummary(summarizeWorkout(latest, logs, allSets))
    } else setPriorSummary(undefined)
    setLoading(false)
  }, [storage])

  useEffect(() => { void load().catch(() => { setError('We could not load your local training data. Try again.'); setLoading(false) }) }, [load])

  if (loading) return <div className="page" data-testid="route-loading" role="status">Loading your private training space…</div>
  if (!profile) return <div className="page"><Status kind="error">Your profile is not complete.</Status><Link className="button button-primary" to="/onboarding">Complete onboarding</Link></div>
  const readyProfile = profile
  let decision
  try { decision = resolveSchedule({ settings: profile, now: new Date(), sessions }) } catch { decision = undefined }
  const resume = decision?.resume
  const next = decision?.next
  const missed = decision?.missed[0]
  const completed = sessions.filter((session) => session.status === 'completed').length
  const backupDue = isBackupReminderDue(sessions, appMeta)

  async function startOccurrence(workoutKey: 'A' | 'B' | 'C', scheduledDate: `${number}-${number}-${number}`) {
    const stamp = nowIso()
    const session = await storage.createSession({ id: newId(), workoutKey, planVersion: plan.version || readyProfile.planVersion, scheduledDate, startedAt: stamp })
    navigate(`/workout/${session.id}`)
  }
  async function start() {
    if (!next) return
    await startOccurrence(next.workoutKey, next.scheduledDate)
  }
  async function startMissedLate() {
    if (!missed) return
    await startOccurrence(missed.workoutKey, missed.scheduledDate)
  }
  async function skipMissed() {
    if (!missed) return
    const created = await storage.createSession({ id: newId(), workoutKey: missed.workoutKey, planVersion: readyProfile.planVersion, scheduledDate: missed.scheduledDate })
    await storage.updateSession({ ...created, status: 'skipped', activeState: undefined, updatedAt: nowIso() })
    await load()
  }

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Your next step</p><h2>Today</h2></div><span className="pill">{profile.daysPerWeek} days · {profile.mode}</span></div>
    {error && <Status kind="error">{error}</Status>}
    <Card className="hero-card" data-testid="today-next-workout"><p className="eyebrow">{resume ? 'In progress' : 'Next workout'}</p><h3>{resume ? `Workout ${resume.workoutKey}` : next ? `Workout ${next.workoutKey}` : 'Recovery day'}</h3><p className="muted">{resume ? 'Pick up exactly where you left off.' : next ? `Planned for ${readableDate(next.scheduledDate)} · about 30 minutes` : 'Your next training date will appear here.'}</p>{missed ? <><Status kind="warning">Missed fixed-day session: Workout {missed.workoutKey} was planned for {readableDate(missed.scheduledDate)}. Complete it late or skip it; future weekdays stay in place.</Status><div className="form-actions"><Button variant="secondary" onClick={() => void startMissedLate()} data-testid="complete-missed">Complete late</Button><Button variant="ghost" onClick={() => void skipMissed()} data-testid="skip-missed">Skip missed session</Button></div></> : <Button onClick={() => resume ? navigate(`/workout/${resume.id}`) : void start()} data-testid={resume ? 'resume-workout' : 'start-workout'}>{resume ? 'Resume workout' : next ? `Start Workout ${next.workoutKey}` : 'No workout ready'}</Button>}</Card>
    <div className="two-col"><Card data-testid="today-recovery"><h3>Recovery</h3><p className="metric">{priorSummary ? 'Recover and repeat' : 'First session'}</p><p className="muted">{priorSummary ? recoveryLabel(priorSummary) : 'Start gently and use the written form guide.'}</p>{priorSummary && <p>{priorSummary.totalReps ? `${priorSummary.totalReps} total reps` : `${priorSummary.totalDurationSeconds} seconds of holds`} · {priorSummary.durationSeconds ? `${Math.round(priorSummary.durationSeconds / 60)} minutes` : 'duration not recorded'}</p>}</Card><Card><h3>Backup</h3><p>{completed === 0 ? 'After your first completed workout, export a backup.' : appMeta?.lastSuccessfulExportAt ? `Last successful backup: ${new Date(appMeta.lastSuccessfulExportAt).toLocaleDateString()}.` : 'Export your first backup to protect this history.'}</p>{backupDue && completed > 0 && <Status kind="warning" data-testid="backup-reminder">Back up now: your latest local history is not recently exported.</Status>}<Link to="/settings/backups" className="text-button">Manage backup</Link></Card></div>
    <Card data-testid="today-prior-summary"><h3>Prior completed workout</h3><p>{priorSummary ? recoveryLabel(priorSummary) : 'No prior completed workout to summarize.'}</p>{priorSummary && <ul>{priorSummary.exercises.filter((exercise) => exercise.setsCompleted > 0).slice(0, 3).map((exercise) => <li key={exercise.exerciseLogId}>{exercise.exerciseId}: {exercise.setsCompleted} sets{exercise.totalReps ? ` · ${exercise.totalReps} reps` : ''}</li>)}</ul>}</Card>
    <Card><h3>Quick links</h3><div className="link-row"><Link to="/desk-reset">Start the optional five-minute desk reset</Link><Link to="/exercises">Browse exercise guides</Link><Link to="/settings/schedule">Adjust schedule</Link></div></Card>
  </div>
}
