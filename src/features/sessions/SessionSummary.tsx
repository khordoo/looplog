/* eslint-disable react-refresh/only-export-components -- shared selectors and presentational primitives intentionally share this feature boundary */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Band, Exercise, ExerciseLog, PerformanceRecord, PlanSlot, SetLog, Substitution, TargetSnapshot, WorkoutKey, WorkoutSession } from '../../domain/types'
import { useStorage } from '../../app/providers/AppProvider'
import { exerciseById, exercises, slotsFor } from '../../lib/content'
import { exerciseArtFor } from '../../lib/exercise-art'
import { WorkoutIcon } from '../../components/ui/WorkoutIcons'
import { Button } from '../../components/ui/Status'
import { SessionEditor } from './SessionEditor'

export const PLANNED_REST_SECONDS = 60

export function restSecondsFor(target: TargetSnapshot, slot?: PlanSlot): number {
  return target.restSeconds ?? slot?.restSeconds ?? PLANNED_REST_SECONDS
}

export const effortText: Record<PerformanceRecord['sets'][number]['effort'], string> = {
  easy: 'Easy',
  'just-right': 'Just right',
  'max-effort': 'Max effort',
  'form-broke': 'Form broke',
}

export interface SessionOutlineItem {
  slot: PlanSlot
  exerciseId: string
  target: TargetSnapshot
  latest?: PerformanceRecord
  exercise?: Exercise
  exerciseNameSnapshot?: string
}

export function formatTarget(target: TargetSnapshot): string {
  if (target.durationSeconds) return `${target.sets} × ${target.durationSeconds.min}–${target.durationSeconds.max} sec`
  return `${target.sets} × ${target.repRange?.min ?? 8}–${target.repRange?.max ?? 12}`
}

export function formatSetValue(set: PerformanceRecord['sets'][number] | SetLog): string {
  return set.durationSeconds === undefined ? `${set.reps ?? 0} reps` : `${set.durationSeconds} sec`
}

export function bandName(band: Band | undefined, key: string): string {
  if (!band) return key === 'bodyweight' ? 'Bodyweight' : key
  return `${band.displayColor} #${band.number}${band.nickname ? ` · ${band.nickname}` : ''}`
}

export function BandPills({ bandKeys, bands, className = '' }: { bandKeys: string[]; bands: Band[]; className?: string }) {
  if (!bandKeys.length) return <span className={`band-pills ${className}`.trim()}>Bodyweight</span>
  return <span className={`band-pills ${className}`.trim()}>{bandKeys.map((key) => {
    const band = bands.find((item) => item.key === key)
    return <span className="band-pill" key={key} aria-label={`Band ${bandName(band, key)}`}>
      <span className={`band-dot ${band ? `band-${band.displayColor.toLowerCase()}` : 'band-unknown'}`} aria-hidden="true" />
      {bandName(band, key)}
    </span>
  })}</span>
}

export function formatLatestPerformance(performance: PerformanceRecord | undefined, bands: Band[]): string {
  if (!performance) return 'First time'
  return performance.sets.map((set) => formatSetValue(set)).join(' · ')
    + ` · ${performance.sets.length ? performance.sets.map((set) => bandName(bands.find((band) => set.bandKeys.includes(band.key)), set.bandKeys[0] ?? 'bodyweight')).join(' / ') : 'Bodyweight'}`
}

async function resolveOutline(storage: ReturnType<typeof useStorage>, workoutKey: WorkoutKey, session?: WorkoutSession): Promise<SessionOutlineItem[]> {
  const [resolved, substitutions, logs, catalog] = await Promise.all([
    storage.resolvePlan ? storage.resolvePlan(workoutKey) : Promise.resolve(undefined),
    storage.listSubstitutions(),
    session ? storage.getExerciseLogs(session.id) : Promise.resolve([] as ExerciseLog[]),
    storage.listExercises ? storage.listExercises({ includeArchived: true }) : Promise.resolve(exercises),
  ])
  const defaultSlots = resolved?.slots ?? slotsFor(workoutKey)
  const sortedLogs = logs.slice().sort((a, b) => a.order - b.order)
  const slotFromLog = (log: ExerciseLog): PlanSlot => ({ id: log.planSlotId, workoutKey, order: log.order, exerciseId: log.exerciseId, category: 'core', defaultSets: log.targetSnapshot.sets, restSeconds: log.targetSnapshot.restSeconds ?? PLANNED_REST_SECONDS, startingResistance: 'bodyweight', ...(log.targetSnapshot.repRange ? { repRange: log.targetSnapshot.repRange } : { durationSeconds: log.targetSnapshot.durationSeconds }) })
  const source: Array<{ slot: PlanSlot; exerciseId: string; target: TargetSnapshot; exerciseNameSnapshot?: string }> = sortedLogs.length
    ? sortedLogs.map((log) => ({ slot: defaultSlots.find((slot) => slot.id === log.planSlotId) ?? slotFromLog(log), exerciseId: log.exerciseId, target: log.targetSnapshot, exerciseNameSnapshot: log.exerciseNameSnapshot }))
    : defaultSlots.map((slot) => {
      const substitution = resolved ? undefined : substitutions.find((item) => item.planSlotId === slot.id && !slot.isAccessory)
      const exerciseId = substitution?.selectedExerciseId ?? slot.exerciseId
      return { slot, exerciseId, target: { sets: slot.defaultSets, repRange: slot.repRange, durationSeconds: slot.durationSeconds, bandKeys: [], source: 'default' as const } as TargetSnapshot, exerciseNameSnapshot: undefined }
    })
  const recent = await Promise.all(source.map(async (item) => ({ item, latest: (await storage.listRecentPerformance(item.exerciseId, 1))[0] })))
  return recent.map(({ item, latest }) => ({ ...item, latest, exercise: catalog.find((record) => record.id === item.exerciseId) }))
}

interface SessionSummaryProps {
  workoutKey: WorkoutKey
  session?: WorkoutSession
  compact?: boolean
  showImages?: boolean
}

export function SessionSummary({ workoutKey, session, compact = false, showImages = true }: SessionSummaryProps) {
  const storage = useStorage()
  const [items, setItems] = useState<SessionOutlineItem[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([resolveOutline(storage, workoutKey, session), storage.getBands()]).then(([nextItems, nextBands]) => {
      if (cancelled) return
      setItems(nextItems); setBands(nextBands); setLoading(false)
    }).catch(() => { if (!cancelled) { setError('Unable to load this session outline.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [session, storage, workoutKey])
  if (loading) return <div className="session-summary-loading" role="status">Loading session outline…</div>
  if (error) return <p className="help" role="alert">{error}</p>
  return <div className={['session-summary', compact && 'session-summary-compact', !showImages && 'session-summary-no-art'].filter(Boolean).join(' ')} data-testid={`session-summary-${workoutKey}`}>
    {!compact && <div className="session-summary-header" aria-hidden="true"><span>Movement</span><span>Recommended</span><span>Last time</span><span>Rest</span></div>}
    {items.map((item) => {
      const exercise = item.exercise ?? exerciseById(item.exerciseId)
      const art = exercise?.photoDataUrl ?? exerciseArtFor(item.exerciseId)
      return <article className="session-summary-row" key={`${item.slot.id}-${item.exerciseId}`} data-testid={`session-summary-row-${item.slot.id}`}>
        {showImages && <div className="session-summary-art">{art ? <img src={art} alt="" width="640" height="640" loading="lazy" /> : <span aria-hidden="true"><WorkoutIcon name="mobility" size={26} /></span>}</div>}
        <div className="session-summary-movement"><strong>{item.exerciseNameSnapshot ?? exercise?.name ?? item.exerciseId}</strong>{item.slot.isAccessory && <span className="help">Accessory</span>}</div>
        <div className="session-summary-field"><span className="session-summary-label">Recommended</span><strong>{formatTarget(item.target)}{item.target.repRange && exercise?.id.includes('lunge') ? ' per side' : ''}</strong></div>
        <div className="session-summary-field"><span className="session-summary-label">Last time</span>{item.latest ? <div className="session-performance-sets">{item.latest.sets.map((set, index) => <div className="session-performance-set" key={`${item.latest?.completedAt}-${index}`}><span>{formatSetValue(set)}</span><BandPills bandKeys={set.bandKeys} bands={bands} /><span className="effort-label">{effortText[set.effort]}</span></div>)}</div> : <span className="first-time">First time</span>}</div>
        <div className="session-summary-field session-summary-rest"><span className="session-summary-label">Rest</span><strong>{Math.floor(restSecondsFor(item.target, item.slot) / 60)}:{String(restSecondsFor(item.target, item.slot) % 60).padStart(2, '0')}</strong></div>
      </article>
    })}
  </div>
}

export function sessionExerciseSlots(workoutKey: WorkoutKey, substitutions: Substitution[] = []) {
  return slotsFor(workoutKey).map((slot) => {
    const replacement = substitutions.find((item) => item.planSlotId === slot.id && !slot.isAccessory)
    const exerciseId = replacement?.selectedExerciseId ?? slot.exerciseId
    return { slot, exerciseId, exercise: exerciseById(exerciseId) }
  })
}

export function SessionDetail({ workoutKey }: { workoutKey: WorkoutKey }) {
  const storage = useStorage()
  const [editing, setEditing] = useState(false)
  const [movementCount, setMovementCount] = useState(slotsFor(workoutKey).length)
  useEffect(() => { let cancelled = false; void (storage.resolvePlan ? storage.resolvePlan(workoutKey).then((resolved) => { if (!cancelled) setMovementCount(resolved.slots.length) }) : Promise.resolve()); return () => { cancelled = true } }, [storage, workoutKey])
  if (editing) return <SessionEditor workoutKey={workoutKey} onDone={() => setEditing(false)} />
  const key = workoutKey
  const template = { A: 'Session A', B: 'Session B', C: 'Session C' }[key]
  return <div className="page session-detail" data-testid="session-detail"><Link to="/exercises" className="text-button">← All exercises</Link><div className="page-heading"><div><p className="eyebrow">Read-only session overview</p><h2>{template}</h2></div><div className="session-detail-actions"><span className="pill">{movementCount} movements · about 30 min</span><Button variant="secondary" onClick={() => setEditing(true)} data-testid="edit-session">Edit session</Button></div></div><p className="muted">Review the recommended target, your latest completed sets, and planned rest before you start.</p><section className="card session-section"><h3>Warm-up</h3><p>Four minutes · easy march, squat rehearsal, shoulder-blade retractions, and hip hinge breathing.</p></section><section className="card session-section"><h3>Working movements</h3><SessionSummary workoutKey={key} showImages={false} /></section><section className="card session-section"><h3>Cooldown</h3><p>Easy breathing and walk around, half-kneeling hip-flexor stretch, and book opener / thoracic rotation.</p></section></div>
}
