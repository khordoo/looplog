import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ExerciseLog, PerformanceRecord, SetLog, WorkoutSession } from '../../domain/types'
import { summarizeWorkout } from '../../domain/summaries'
import { useStorage } from '../../app/providers/AppProvider'
import { exerciseById } from '../../lib/content'
import { Card, Status } from '../../components/ui/Status'

function dateLabel(date: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)) }

export function History() {
  const storage = useStorage(); const [sessions, setSessions] = useState<WorkoutSession[]>([]); const [summaries, setSummaries] = useState<Record<string, ReturnType<typeof summarizeWorkout>>>({}); const [loading, setLoading] = useState(true)
  useEffect(() => { void Promise.resolve(storage.listSessions({ status: 'completed' })).then(async (items) => { const safeItems = items ?? []; const next: Record<string, ReturnType<typeof summarizeWorkout>> = {}; for (const session of safeItems) { const logs = await storage.getExerciseLogs(session.id); const allSets: SetLog[] = []; for (const log of logs) allSets.push(...await storage.getSetLogs(log.id)); next[session.id] = summarizeWorkout(session, logs, allSets) } setSessions(safeItems); setSummaries(next); setLoading(false) }) }, [storage])
  if (loading) return <div className="page" data-testid="route-loading" role="status">Loading history…</div>
  return <div className="page"><p className="eyebrow">Your local record</p><h2>History</h2>{sessions.length === 0 ? <Card><h3>No completed workouts yet</h3><p>Finish your first session and it will appear here.</p><Link to="/today" className="button button-primary">Go to Today</Link></Card> : <div className="history-list" data-testid="history-list">{sessions.map((session) => { const summary = summaries[session.id]; return <Card key={session.id}><div className="page-heading"><div><h3>Workout {session.workoutKey}</h3><p className="muted">{dateLabel(session.scheduledDate)} · {Math.round((session.durationSeconds ?? 0) / 60)} minutes</p></div><span className="pill">{summary?.setsCompleted ?? 0} sets</span></div><p>{summary?.totalReps ? `${summary.totalReps} total reps` : `${summary?.totalDurationSeconds ?? 0} seconds of holds`}</p><Link className="text-button" data-testid={`history-session-${session.id}`} to={`/history/${session.id}`}>View session</Link></Card> })}</div>}</div>
}

export function HistoryDetail() {
  const storage = useStorage(); const [session, setSession] = useState<WorkoutSession>(); const [logs, setLogs] = useState<ExerciseLog[]>([]); const [sets, setSets] = useState<SetLog[]>([]); const [previous, setPrevious] = useState<Record<string, PerformanceRecord[]>>({}); const { sessionId = '' } = useParams()
  useEffect(() => {
    let cancelled = false
    void storage.getSession(sessionId).then(async (found) => {
      if (!found) return
      const nextLogs = await storage.getExerciseLogs(found.id)
      const nextSets: SetLog[] = []
      const nextPrevious: Record<string, PerformanceRecord[]> = {}
      for (const log of nextLogs) {
        nextSets.push(...await storage.getSetLogs(log.id))
        nextPrevious[log.exerciseId] = (await Promise.resolve(storage.listRecentPerformance(log.exerciseId, 8)) ?? []).filter((record) => record.sessionId !== found.id)
      }
      if (!cancelled) { setSession(found); setLogs(nextLogs); setSets(nextSets); setPrevious(nextPrevious) }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [sessionId, storage])
  if (!session) return <div className="page"><Status kind="info">Loading session…</Status></div>
  const summary = summarizeWorkout(session, logs, sets)
  const orderedLogs = [...logs].sort((a, b) => a.order - b.order)
  return <div className="page"><Link to="/history" className="text-button">← History</Link><p className="eyebrow">Completed {session.scheduledDate}</p><h2>Workout {session.workoutKey}</h2><Card><p><strong>{summary.setsCompleted} sets</strong> · {summary.totalReps ? `${summary.totalReps} reps` : `${summary.totalDurationSeconds} seconds of holds`}</p>{orderedLogs.map((log) => { const exerciseSets = sets.filter((set) => set.exerciseLogId === log.id).sort((a, b) => a.setNumber - b.setNumber); const prior = previous[log.exerciseId]?.[0]; return <article className="history-exercise history-exercise-detail" key={log.id}><div><h3>{exerciseById(log.exerciseId)?.name ?? log.exerciseId}</h3><p className="muted">Target: {log.targetSnapshot.durationSeconds ? `${log.targetSnapshot.durationSeconds.min}–${log.targetSnapshot.durationSeconds.max}s` : `${log.targetSnapshot.repRange?.min ?? 0}–${log.targetSnapshot.repRange?.max ?? 0} reps`} · {log.targetSnapshot.sets} sets</p><p><strong>This session:</strong> {exerciseSets.length ? exerciseSets.map((set) => set.reps ?? `${set.durationSeconds}s`).join(' · ') : 'No sets logged'}</p>{prior ? <p className="muted"><strong>Previous:</strong> {prior.sets.map((set) => set.reps ?? `${set.durationSeconds}s`).join(' · ') || 'No result'} on {dateLabel(prior.completedAt.slice(0, 10))}</p> : <p className="muted">No previous result for this exercise.</p>}</div><div className="history-progression" aria-label={`${exerciseById(log.exerciseId)?.name ?? log.exerciseId} set details`}>{exerciseSets.map((set) => <span key={set.id}>Set {set.setNumber}: {set.reps ?? `${set.durationSeconds}s`} · {set.effort.replace('-', ' ')}</span>)}</div></article> })}</Card></div>
}
