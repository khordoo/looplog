/* eslint-disable react-refresh/only-export-components -- target conversion is exported for focused boundary tests */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { recommendNextTarget } from '../../domain/progression'
import type {
  Band, EffortRating, Exercise, ExerciseLog, PerformanceRecord, PlanSlot, SetLog, SetupAdjustment,
  TargetSnapshot, WorkoutRecommendation, WorkoutSession, WorkoutSessionState,
} from '../../domain/types'
import { createDefaultWorkoutSessionState } from '../../domain/types'
import { useOnline, useStorage } from '../../app/providers/AppProvider'
import { exerciseById, slotsFor } from '../../lib/content'
import { newId, nowIso } from '../../lib/ids'
import { Button, Card, Dialog, Status } from '../../components/ui/Status'
import { UpdateNotice } from '../../components/feedback/Connectivity'
import { MovementPreview } from './MovementPreview'
import { WarmupPanel } from './WarmupPanel'
import { BandPills, effortText, formatSetValue, PLANNED_REST_SECONDS, restSecondsFor } from '../sessions/SessionSummary'

const effortLabels: Array<[EffortRating, string]> = [
  ['easy', 'Easy — 3+ clean reps remain'],
  ['just-right', 'Just right — 1–2 clean reps remain'],
  ['max-effort', 'Max effort — no clean reps remain'],
  ['form-broke', 'Form broke — target too difficult'],
]
const adjustmentOptions: Array<[SetupAdjustment, string]> = [
  ['standard', 'Standard'], ['shortened-grip', 'Shortened grip'],
  ['lengthened-grip', 'Lengthened grip'], ['other', 'Other'],
]

function displayBand(band: Band): string {
  return `${band.displayColor} #${band.number}${band.nickname ? ` · ${band.nickname}` : ''} (${band.nominalMinLb}–${band.nominalMaxLb} lb)`
}

function targetLabel(target?: TargetSnapshot): string {
  if (!target) return '2 × 8–12 reps'
  const base = target.durationSeconds
    ? `${target.sets} × ${target.durationSeconds.min}–${target.durationSeconds.max} seconds`
    : `${target.sets} × ${target.repRange?.min ?? 8}–${target.repRange?.max ?? 12} reps`
  const suggested = target.suggestedReps === undefined ? '' : ` · proposed ${target.suggestedReps}`
  return `${base}${suggested}${target.progressionCue ? ` · ${target.progressionCue}` : ''}`
}

export function targetForSnapshot(slot: ReturnType<typeof slotsFor>[number], exerciseId: string): TargetSnapshot {
  const selected = exerciseById(exerciseId)
  const slotIsTimed = Boolean(slot.durationSeconds)
  const selectedIsTimed = Boolean(selected?.defaultTarget.durationSeconds)
  if (selected && slotIsTimed !== selectedIsTimed) {
    return {
      ...selected.defaultTarget,
      sets: slot.defaultSets,
      bandKeys: [],
      source: 'default',
    }
  }
  return {
    sets: slot.defaultSets,
    repRange: slot.repRange,
    durationSeconds: slot.durationSeconds,
    bandKeys: [],
    source: 'default',
  }
}

function stateFor(
  phase: 'warmup' | 'working' | 'cooldown',
  activeExerciseIndex: number,
  draft: WorkoutSessionState['draft'],
  restTimerSeconds: number,
  restTimerRunning: boolean,
): WorkoutSessionState {
  return { phase, activeExerciseIndex, draft, restTimerSeconds, restTimerRunning }
}

export function Workout() {
  const storage = useStorage()
  const online = useOnline()
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const [session, setSession] = useState<WorkoutSession>()
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [sets, setSets] = useState<SetLog[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [bandInventory, setBandInventory] = useState<Band[]>([])
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>([])
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([])
  const [snapshotSlots, setSnapshotSlots] = useState<PlanSlot[]>()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<WorkoutSessionState['phase']>('warmup')
  const [reps, setReps] = useState('')
  const [duration, setDuration] = useState('')
  const [bandKeys, setBandKeys] = useState<string[]>([])
  const [setup, setSetup] = useState<SetupAdjustment>('standard')
  const [setupNote, setSetupNote] = useState('')
  const [exerciseNote, setExerciseNote] = useState('')
  const [effort, setEffort] = useState<EffortRating>('just-right')
  const [timer, setTimer] = useState(60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [recommendation, setRecommendation] = useState<WorkoutRecommendation>()
  const [previousPerformance, setPreviousPerformance] = useState<PerformanceRecord>()
  const [showVideo, setShowVideo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [finishConfirm, setFinishConfirm] = useState(false)

  // A finalized session is history, never an entry point to a new active run.
  useEffect(() => {
    let cancelled = false
    void Promise.all([storage.getSession(sessionId), storage.getBands(), storage.listExercises ? storage.listExercises({ includeArchived: true }) : Promise.resolve([] as Exercise[])]).then(async ([found, inventory, catalog]) => {
      if (!found) throw new Error('Workout not found')
      if (found.status === 'completed' || found.status === 'skipped') throw new Error('This workout is already finalized and cannot be resumed.')
      const stamp = nowIso()
      const state = found.activeState ?? createDefaultWorkoutSessionState()
      const active = found.status === 'in-progress'
        ? { ...found, activeState: state }
        : { ...found, status: 'in-progress' as const, startedAt: found.startedAt ?? stamp, activeState: state, updatedAt: stamp }
      if (found.status !== 'in-progress' || !found.activeState) await storage.updateSession(active)
      if (cancelled) return
      setSession(active)
      setPlanSlots([])
      setSnapshotSlots(undefined)
      setBandInventory(inventory)
      setBands(inventory.filter((band) => band.enabled).sort((a, b) => a.number - b.number))
      setExerciseCatalog(catalog)
      setPhase(state.phase)
      setIndex(state.activeExerciseIndex)
      setReps(state.draft.reps ?? '')
      setDuration(state.draft.durationSeconds ?? '')
      setBandKeys([...state.draft.bandKeys])
      setSetup(state.draft.setupAdjustment)
      setSetupNote(state.draft.setupNote ?? '')
      setEffort(state.draft.effort)
      setTimer(state.restTimerSeconds)
      setTimerRunning(state.restTimerRunning)
      setHydrated(true)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!cancelled) { setError(cause instanceof Error ? cause.message : 'Unable to load workout.'); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [sessionId, storage])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    void (storage.resolvePlan ? storage.resolvePlan(session.workoutKey).then((resolved) => { if (!cancelled) setPlanSlots(resolved.slots) }) : Promise.resolve().then(() => { if (!cancelled) setPlanSlots(slotsFor(session.workoutKey)) }))
    return () => { cancelled = true }
  }, [session, storage])

  const slots = snapshotSlots ?? planSlots

  // Resolve substitutions only when creating the session snapshot. Existing
  // logs are never rebuilt, so later preference changes cannot rewrite history.
  useEffect(() => {
    if (!session || !planSlots.length) return
    let cancelled = false
    void (async () => {
      const [existing, substitutions] = await Promise.all([
        storage.getExerciseLogs(session.id), storage.listSubstitutions(),
      ])
      let nextLogs = existing
      if (!nextLogs.length) {
        const bySlot = new Map(substitutions.map((item) => [item.planSlotId, item]))
        nextLogs = await Promise.all(planSlots.map((slot) => {
          const substitution = slot.isAccessory ? undefined : bySlot.get(slot.id)
          const exerciseId = substitution?.selectedExerciseId ?? slot.exerciseId
          return storage.createExerciseLog({
            sessionId: session.id,
            exerciseId,
            planSlotId: slot.id,
            order: slot.order,
            targetSnapshot: targetForSnapshot(slot, exerciseId),
          })
        }))
      }
      const nextSets = (await Promise.all(nextLogs.map((log) => storage.getSetLogs(log.id)))).flat()
      if (!cancelled) {
        setLogs(nextLogs.sort((a, b) => a.order - b.order))
        setSets(nextSets)
        const byId = new Map(planSlots.map((slot) => [slot.id, slot]))
        setSnapshotSlots(nextLogs.slice().sort((a, b) => a.order - b.order).map((log) => {
          const source = byId.get(log.planSlotId)
          return { ...(source ?? { id: log.planSlotId, workoutKey: session.workoutKey, category: 'core' as const, startingResistance: 'bodyweight' as const }), id: log.planSlotId, exerciseId: log.exerciseId, order: log.order, defaultSets: log.targetSnapshot.sets, restSeconds: log.targetSnapshot.restSeconds ?? source?.restSeconds ?? 60, repRange: log.targetSnapshot.repRange, durationSeconds: log.targetSnapshot.durationSeconds }
        }))
      }
    })().catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to create exercise logs.') })
    return () => { cancelled = true }
  }, [session, planSlots, storage])

  const currentLog = logs[index]
  const currentSlot = slots[index]
  const exercise = currentLog ? (exerciseCatalog.find((item) => item.id === currentLog.exerciseId) ?? exerciseById(currentLog.exerciseId)) : undefined
  const exerciseName = currentLog?.exerciseNameSnapshot ?? exercise?.name ?? currentLog?.exerciseId
  const currentSets = currentLog
    ? sets.filter((set) => set.exerciseLogId === currentLog.id).sort((a, b) => a.setNumber - b.setNumber)
    : []
  const target = currentLog?.targetSnapshot
  const expectedSets = target?.sets ?? 2
  const isTimed = Boolean(target?.durationSeconds)
  const plannedRestSeconds = target && currentSlot ? restSecondsFor(target, currentSlot) : PLANNED_REST_SECONDS

  useEffect(() => {
    if (!currentLog) return
    setExerciseNote(currentLog.note ?? '')
    setShowVideo(false)
    setRecommendation(undefined)
    setPreviousPerformance(undefined)
    void storage.listRecentPerformance(currentLog.exerciseId, 5).then((records) => {
      if (!records.length) return
      setPreviousPerformance(records[0])
      if (!exercise) return
      setRecommendation(recommendNextTarget({ exercise, previousPerformances: records, currentTarget: currentLog.targetSnapshot }))
    })
  }, [currentLog, storage, exercise])

  // Every edit is durable. This effect deliberately writes the complete state
  // as one adapter operation, so refreshes cannot resurrect a stale draft.
  useEffect(() => {
    if (!session || !hydrated || session.status !== 'in-progress') return
    const state = stateFor(phase, index, {
      reps: reps || undefined,
      durationSeconds: duration || undefined,
      bandKeys: [...bandKeys],
      setupAdjustment: setup,
      setupNote: setupNote || undefined,
      effort,
    }, timer, timerRunning)
    const save = storage.saveSessionState
      ? storage.saveSessionState(session.id, state)
      : storage.updateSession({ ...session, activeState: state, updatedAt: nowIso() })
    void Promise.resolve(save).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to save workout state.'))
  }, [session, hydrated, phase, index, reps, duration, bandKeys, setup, setupNote, effort, timer, timerRunning, storage])

  useEffect(() => {
    if (!timerRunning) return
    const interval = window.setInterval(() => setTimer((value) => {
      if (value <= 1) { setTimerRunning(false); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(interval)
  }, [timerRunning])

  async function completeSet() {
    if (!currentLog || !target) return
    if (currentSets.length >= expectedSets) {
      setError('All target sets are already saved. Continue to the next exercise.'); return
    }
    const value = Number(isTimed ? duration : reps)
    const range = isTimed ? target.durationSeconds : target.repRange
    if (!Number.isFinite(value) || value <= 0 || (range && value > range.max * 2)) {
      setError(`Enter a valid ${isTimed ? 'duration' : 'rep'} value.`); return
    }
    if (setup === 'other' && !setupNote.trim()) {
      setError('Describe the other setup so this set remains understandable in history.'); return
    }
    setError('')
    const nextSetNumber = (currentSets.at(-1)?.setNumber ?? 0) + 1
    const created = await storage.createSetLog({
      id: newId(), exerciseLogId: currentLog.id, setNumber: nextSetNumber,
      ...(isTimed ? { durationSeconds: value } : { reps: value }),
      bandKeys: [...bandKeys], setupAdjustment: setup, setupNote: setupNote || undefined,
      effort, completedAt: nowIso(),
    })
    setSets((current) => current.some((item) => item.id === created.id) ? current : [...current, created])
    setReps(''); setDuration(''); setSetupNote(''); setTimer(plannedRestSeconds); setTimerRunning(true)
  }

  function useLastSetup() {
    const firstSet = previousPerformance?.sets[0]
    if (!firstSet) return
    setBandKeys([...firstSet.bandKeys])
    setSetup(firstSet.setupAdjustment ?? 'standard')
  }

  async function applyRecommendation() {
    if (!currentLog || !recommendation) return
    if (!storage.updateExerciseLog) { setError('This storage adapter cannot persist target changes.'); return }
    await storage.updateExerciseLog({ ...currentLog, targetSnapshot: recommendation.proposedTarget, updatedAt: nowIso() })
    setLogs((current) => current.map((item) => item.id === currentLog.id ? { ...item, targetSnapshot: recommendation.proposedTarget, updatedAt: nowIso() } : item))
    setBandKeys([...recommendation.proposedTarget.bandKeys])
    setSetup(recommendation.proposedTarget.setupAdjustment ?? 'standard')
    setRecommendation(undefined)
  }

  async function saveExerciseNote() {
    if (!currentLog || exerciseNote === (currentLog.note ?? '')) return
    const updated = { ...currentLog, note: exerciseNote || undefined, updatedAt: nowIso() }
    if (!storage.updateExerciseLog) return
    await storage.updateExerciseLog(updated)
    setLogs((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  const incompleteExercises = useMemo(() => logs.filter((log) => sets.filter((set) => set.exerciseLogId === log.id).length < log.targetSnapshot.sets), [logs, sets])
  async function finish() {
    if (!session) return
    const updated = {
      ...session, status: 'completed' as const, completedAt: nowIso(),
      durationSeconds: Math.max(1, Math.round((Date.now() - new Date(session.startedAt ?? Date.now()).getTime()) / 1000)),
      // Finalized sessions have no resumable state; status is the authority
      // that keeps them out of Today and active-workout resume flows.
      activeState: undefined,
      updatedAt: nowIso(),
    }
    await storage.updateSession(updated)
    setFinishConfirm(false)
    navigate('/history')
  }
  async function skip() {
    if (!session) return
    await storage.updateSession({ ...session, status: 'skipped', activeState: undefined, updatedAt: nowIso() })
    navigate('/today')
  }

  if (loading) return <div className="page" data-testid="route-loading" role="status">Loading workout…</div>
  if (!session) return <div className="page"><Status kind="error">{error || 'This workout could not be loaded.'}</Status><Link to="/today" className="button button-primary">Back to Today</Link></div>
  if (phase === 'warmup') return <WarmupPanel workoutKey={session.workoutKey} onComplete={() => setPhase('working')} notice={<UpdateNotice activeWorkout />} />
  if (phase === 'cooldown') return <div className="page workout-page"><UpdateNotice activeWorkout /><p className="eyebrow">Workout {session.workoutKey} · cooldown</p><h2>Cool down</h2><Card><h3>Finish with easy breathing</h3><p>Walk around, breathe comfortably, and use a gentle hip-flexor stretch or thoracic rotation. Nothing in the cooldown changes progression.</p>{incompleteExercises.length > 0 && <Status kind="warning">{incompleteExercises.length} exercise{incompleteExercises.length === 1 ? '' : 's'} still has fewer than its target sets. You can finish incomplete, but confirm below.</Status>}<Button onClick={() => setFinishConfirm(true)} data-testid="finish-workout">Finish workout</Button></Card>{finishConfirm && <Dialog title="Finish workout?" onClose={() => setFinishConfirm(false)} actions={<><Button variant="secondary" onClick={() => setFinishConfirm(false)}>Keep cooling down</Button><Button onClick={() => void finish()} data-testid="finish-confirm">{incompleteExercises.length ? 'Finish incomplete workout' : 'Finish'}</Button></>}><p>{incompleteExercises.length ? 'Some target sets are missing. Finish explicitly to keep this partial session in history.' : `Mark Workout ${session.workoutKey} complete and add it to History?`}</p></Dialog>}</div>
  if (!currentSlot || !currentLog) return <div className="page">{phase === 'working' && slots.length > 0 && !error ? <div role="status">Preparing your exercise logs…</div> : <><Status kind="error">{error || 'This workout has no exercise content yet.'}</Status><Link to="/today" className="button button-primary">Back to Today</Link></>}</div>
  return <div className="page workout-page">
    <UpdateNotice activeWorkout />
    <div className="workout-top"><div><p className="eyebrow">Workout {session.workoutKey} · {index + 1} of {slots.length}{currentSlot.isAccessory ? ' · accessory paired with C-5' : ''}</p><h2 data-testid="active-exercise">{exerciseName}</h2></div><button className="text-button" onClick={() => setLeaveConfirm(true)}>Pause</button></div>
    {!online && <Status kind="warning">Offline mode: your entries save locally. Demonstration videos need connectivity.</Status>}
    {exercise && <MovementPreview exercise={exercise} online={online} showVideo={showVideo} onShowVideo={() => setShowVideo(true)} compact />}
    <Card className="target-card"><div><p className="eyebrow">Recommended target</p><strong data-testid="active-target">{targetLabel(target)}</strong><span className="target-rest">Rest {Math.floor(plannedRestSeconds / 60)}:{String(plannedRestSeconds % 60).padStart(2, '0')} between sets</span></div><div className="previous-performance"><p className="eyebrow">Last time · set by set</p>{previousPerformance ? <div className="previous-set-list" data-testid="previous-result"><span className="sr-only">{previousPerformance.sets.map((set) => set.reps ?? `${set.durationSeconds ?? 0}s`).join(' · ')} · {previousPerformance.sets.flatMap((set) => set.bandKeys.length ? set.bandKeys : ['bodyweight']).join(' · ')}</span>{previousPerformance.sets.map((set, setIndex) => <div className="previous-set" key={`${previousPerformance?.completedAt}-${setIndex}`}><strong>Set {setIndex + 1}</strong><span>{formatSetValue(set)}</span><BandPills bandKeys={set.bandKeys} bands={bandInventory} /><span className="effort-label">{effortText[set.effort]}</span>{set.setupAdjustment && set.setupAdjustment !== 'standard' && <span className="help">{set.setupAdjustment.replace('-', ' ')}</span>}</div>)}</div> : <span data-testid="previous-result">First time</span>}{previousPerformance && <Button variant="secondary" onClick={useLastSetup} data-testid="use-last-setup">Use last setup</Button>}</div></Card>
    {recommendation && <details className="proposal"><summary><strong>Proposed target:</strong> {targetLabel(recommendation.proposedTarget)}</summary><p>{recommendation.rationale}</p><Button onClick={() => void applyRecommendation()} data-testid="confirm-recommendation">Confirm and use</Button></details>}
    <Card className="set-entry-card"><div className="set-card-heading"><h3>{currentSets.length >= expectedSets ? `Target sets saved (${expectedSets} of ${expectedSets})` : `Set ${currentSets.length + 1} of ${expectedSets}`}</h3><Button onClick={() => void completeSet()} disabled={currentSets.length >= expectedSets} data-testid="set-complete">{currentSets.length >= expectedSets ? 'Target sets saved' : 'Save set'}</Button></div><div className="two-col set-entry-grid"><label>{isTimed ? 'Duration (seconds)' : 'Repetitions'}<input inputMode="numeric" type="number" min="1" value={isTimed ? duration : reps} onChange={(event) => isTimed ? setDuration(event.target.value) : setReps(event.target.value)} data-testid={isTimed ? 'set-duration' : 'set-reps'} /></label><label>Effort<select value={effort} onChange={(event) => setEffort(event.target.value as EffortRating)} data-testid="effort-select">{effortLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><fieldset><legend>Band or bodyweight</legend><div className="band-choices">{bands.map((band) => <label key={band.key}><input type="checkbox" checked={bandKeys.includes(band.key)} onChange={() => setBandKeys((current) => current.includes(band.key) ? current.filter((item) => item !== band.key) : [...current, band.key])} /> <span className={`band-dot band-${band.displayColor}`} aria-hidden="true" />{displayBand(band)}</label>)}<span className="help">Leave all unchecked for bodyweight. Multiple bands may be selected.</span></div></fieldset><label>Setup adjustment<select value={setup} onChange={(event) => setSetup(event.target.value as SetupAdjustment)} data-testid="setup-adjustment">{adjustmentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{setup === 'other' && <label>Describe setup<input value={setupNote} onChange={(event) => setSetupNote(event.target.value)} placeholder="e.g. shortened grip above the knees" data-testid="setup-note" /></label>}<details><summary>Optional exercise note</summary><label>Exercise notes<textarea value={exerciseNote} onChange={(event) => setExerciseNote(event.target.value)} onBlur={() => void saveExerciseNote()} placeholder="Optional notes" data-testid="exercise-note" /></label></details></Card>
    <Card className="form-guide-card">{exercise ? <details><summary><span>Full form guide</span><small>Setup, movement, breathing & safety</small></summary><div className="form-guide-content"><p><strong>Setup:</strong> {exercise.setup.join(' ')}</p><ol>{exercise.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><strong>Tempo and breathing:</strong> {exercise.breathingTempo}</p>{exercise.bandWarnings.length > 0 && <p className="help"><strong>Band safety:</strong> {exercise.bandWarnings.join(' ')}</p>}</div></details> : <p>Written guide unavailable for this exercise.</p>}</Card>
    <Card className="timer-card"><div><p className="eyebrow">Rest timer</p><strong data-testid="rest-timer">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</strong></div><div className="form-actions"><Button variant="secondary" onClick={() => setTimerRunning((value) => !value)} data-testid="rest-timer-pause">{timerRunning ? 'Pause' : 'Start'}</Button><Button variant="ghost" onClick={() => { setTimer(0); setTimerRunning(false) }} data-testid="rest-timer-skip">Skip</Button></div></Card>
    <div className="form-actions workout-actions"><Button variant="secondary" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</Button>{index < slots.length - 1 ? <Button onClick={() => setIndex((value) => value + 1)}>Next exercise</Button> : <Button onClick={() => setPhase('cooldown')} data-testid="finish-workout">Start cooldown</Button>}<Button variant="ghost" onClick={() => void skip()} data-testid="skip-workout">Skip session</Button></div>
    {leaveConfirm && <Dialog title="Pause this workout?" onClose={() => setLeaveConfirm(false)} actions={<><Button variant="secondary" onClick={() => setLeaveConfirm(false)}>Keep going</Button><Button onClick={() => { setLeaveConfirm(false); navigate('/today') }}>Pause and save</Button></>}><p>Your entries and exact position are saved locally. You can resume this session from Today.</p></Dialog>}
  </div>
}
