import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise, PlanConfiguration, PlanSlot, RepRange, WorkoutKey } from '../../domain/types'
import { useStorage } from '../../app/providers/AppProvider'
import { exercises as builtInExercises } from '../../lib/content'
import { newId, nowIso } from '../../lib/ids'
import { Button, Card, Dialog, Status } from '../../components/ui/Status'
import { exerciseArtFor } from '../../lib/exercise-art'
import { restSecondsFor } from './SessionSummary'

function defaultConfig(workoutKey: WorkoutKey, slots: PlanSlot[]): PlanConfiguration {
  const stamp = nowIso()
  return { id: workoutKey, workoutKey, revision: 1, sourceVersion: 'v1', slots: slots.map((slot) => ({ ...slot, restSeconds: slot.restSeconds ?? 60 })), warmupMinutes: 4, cooldownMinutes: 2, createdAt: stamp, updatedAt: stamp }
}

function targetRange(slot: PlanSlot): RepRange {
  return slot.repRange ?? slot.durationSeconds ?? { min: 8, max: 12 }
}

function slotForExercise(workoutKey: WorkoutKey, exercise: Exercise, order: number): PlanSlot {
  const timed = Boolean(exercise.defaultTarget.durationSeconds)
  return {
    id: newId(), workoutKey, order, exerciseId: exercise.id, category: exercise.category,
    defaultSets: exercise.defaultTarget.sets, restSeconds: 60,
    ...(timed ? { durationSeconds: { ...exercise.defaultTarget.durationSeconds! } } : { repRange: { ...exercise.defaultTarget.repRange! } }),
    startingResistance: exercise.bandWarnings.length && /band/i.test(exercise.bandWarnings.join(' ')) ? 'band' : 'bodyweight',
    compatibleSubstitutionCategories: exercise.compatibleSubstitutionCategories,
  }
}

export function SessionEditor({ workoutKey, onDone }: { workoutKey: WorkoutKey; onDone: () => void }) {
  const storage = useStorage()
  const [configuration, setConfiguration] = useState<PlanConfiguration>()
  const [draftSlots, setDraftSlots] = useState<PlanSlot[]>([])
  const [catalog, setCatalog] = useState<Exercise[]>(builtInExercises)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [removeSlot, setRemoveSlot] = useState<PlanSlot>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadConfiguration = useCallback(async (): Promise<PlanConfiguration | undefined> => {
    if (storage.getPlanConfiguration) {
      const existing = await storage.getPlanConfiguration(workoutKey)
      if (existing) return existing
    }
    if (storage.resolvePlan) {
      const resolved = await storage.resolvePlan(workoutKey)
      return defaultConfig(workoutKey, resolved.slots)
    }
    return storage.materializePlanConfiguration ? storage.materializePlanConfiguration(workoutKey) : undefined
  }, [storage, workoutKey])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadConfiguration(),
      storage.listExercises ? storage.listExercises({ includeArchived: true }) : Promise.resolve(builtInExercises),
    ]).then(([config, records]) => {
      if (cancelled) return
      if (!config) throw new Error('This storage adapter cannot edit sessions yet.')
      setConfiguration(config); setDraftSlots(config.slots.slice().sort((a, b) => a.order - b.order)); setCatalog(records); setLoading(false)
    }).catch((cause: unknown) => { if (!cancelled) { setError(cause instanceof Error ? cause.message : 'Unable to load this session.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [loadConfiguration, storage, workoutKey])

  const catalogById = useMemo(() => new Map(catalog.map((exercise) => [exercise.id, exercise])), [catalog])
  function updateSlot(id: string, update: Partial<PlanSlot>) { setDraftSlots((slots) => slots.map((slot) => slot.id === id ? { ...slot, ...update } : slot)) }
  function move(id: string, direction: -1 | 1) {
    setDraftSlots((slots) => { const index = slots.findIndex((slot) => slot.id === id); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= slots.length) return slots; const next = slots.slice(); [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next.map((slot, order) => ({ ...slot, order })) })
  }
  function addExercise() {
    const exercise = catalogById.get(selectedExercise)
    if (!exercise) return
    setDraftSlots((slots) => [...slots, slotForExercise(workoutKey, exercise, slots.length)])
    setSelectedExercise('')
  }
  function removeConfirmed() {
    if (!removeSlot) return
    setDraftSlots((slots) => slots.filter((slot) => slot.id !== removeSlot.id).map((slot, order) => ({ ...slot, order })))
    setRemoveSlot(undefined)
  }
  async function save() {
    if (!configuration || !storage.savePlanConfiguration) return
    if (draftSlots.some((slot) => slot.defaultSets < 1 || !Number.isInteger(slot.defaultSets) || (targetRange(slot).min > targetRange(slot).max) || (slot.restSeconds ?? 60) < 1)) { setError('Each movement needs positive sets, a valid target range, and positive rest.'); return }
    setSaving(true); setError('')
    try { await storage.savePlanConfiguration({ ...configuration, slots: draftSlots.map((slot, order) => ({ ...slot, order })), revision: configuration.revision + 1, updatedAt: nowIso() }); onDone() } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to save this session.') } finally { setSaving(false) }
  }
  async function restore() {
    if (!storage.restorePlanDefaults || !storage.materializePlanConfiguration) return
    setSaving(true); setError('')
    try { await storage.restorePlanDefaults(workoutKey); const restored = await loadConfiguration(); if (!restored) throw new Error('Unable to load built-in defaults.'); setConfiguration(restored); setDraftSlots(restored.slots.slice().sort((a, b) => a.order - b.order)) } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to restore defaults.') } finally { setSaving(false) }
  }

  if (loading) return <div className="page" role="status">Loading session editor…</div>
  if (error && !configuration) return <div className="page"><Status kind="error">{error}</Status><Button onClick={onDone}>Back</Button></div>
  return <div className="page session-editor" data-testid="session-editor"><div className="page-heading"><div><Link to={`/sessions/${workoutKey}`} className="text-button">← Session overview</Link><p className="eyebrow">Edit plan</p><h2>Session {workoutKey}</h2></div><span className="pill">Save as one change</span></div><p className="muted">Changes apply to future sessions. In-progress and completed workouts keep their snapshots.</p>{error && <Status kind="error">{error}</Status>}<Card><div className="editor-toolbar"><label>Add movement<select value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}><option value="">Choose an exercise…</option>{catalog.filter((exercise) => !exercise.archived).map((exercise) => <option value={exercise.id} key={exercise.id}>{exercise.name}{exercise.isCustom ? ' · custom' : ''}</option>)}</select></label><Button variant="secondary" onClick={addExercise} disabled={!selectedExercise}>Add movement</Button></div><div className="editor-list">{draftSlots.map((slot, index) => { const exercise = catalogById.get(slot.exerciseId); const range = targetRange(slot); const timed = Boolean(slot.durationSeconds); const art = exercise?.photoDataUrl ?? exerciseArtFor(slot.exerciseId); return <article className="editor-row" key={slot.id} data-testid={`editor-row-${slot.id}`}><div className="editor-row-title"><span className="editor-order">{index + 1}</span>{art ? <img src={art} alt="" width="64" height="64" /> : <span className="editor-art-fallback" aria-hidden="true">◎</span>}<strong>{exercise?.name ?? slot.exerciseId}</strong></div><div className="editor-row-controls"><label>Sets<input type="number" min="1" step="1" value={slot.defaultSets} onChange={(event) => updateSlot(slot.id, { defaultSets: Number(event.target.value) })} /></label><label>Target kind<select value={timed ? 'duration' : 'reps'} onChange={(event) => { const nextTimed = event.target.value === 'duration'; updateSlot(slot.id, nextTimed ? { durationSeconds: range, repRange: undefined } : { repRange: range, durationSeconds: undefined }) }}><option value="reps">Reps</option><option value="duration">Seconds</option></select></label><label>Min<input type="number" min="0" value={range.min} onChange={(event) => updateSlot(slot.id, timed ? { durationSeconds: { ...range, min: Number(event.target.value) } } : { repRange: { ...range, min: Number(event.target.value) } })} /></label><label>Max<input type="number" min="1" value={range.max} onChange={(event) => updateSlot(slot.id, timed ? { durationSeconds: { ...range, max: Number(event.target.value) } } : { repRange: { ...range, max: Number(event.target.value) } })} /></label><label>Rest (seconds)<input type="number" min="1" step="5" value={restSecondsFor({ ...slot, sets: slot.defaultSets, bandKeys: [], source: 'manual', ...(slot.repRange ? { repRange: slot.repRange } : { durationSeconds: slot.durationSeconds }) }, slot)} onChange={(event) => updateSlot(slot.id, { restSeconds: Number(event.target.value) })} /></label></div><div className="editor-row-actions"><Button variant="ghost" onClick={() => move(slot.id, -1)} disabled={index === 0} aria-label={`Move ${exercise?.name ?? slot.exerciseId} up`}>↑</Button><Button variant="ghost" onClick={() => move(slot.id, 1)} disabled={index === draftSlots.length - 1} aria-label={`Move ${exercise?.name ?? slot.exerciseId} down`}>↓</Button><Button variant="ghost" onClick={() => setRemoveSlot(slot)} disabled={draftSlots.length <= 1}>Remove from session</Button></div></article> })}</div></Card><div className="form-actions"><Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save session'}</Button><Button variant="secondary" onClick={onDone} disabled={saving}>Cancel</Button><Button variant="ghost" onClick={() => void restore()} disabled={saving}>Restore built-in defaults</Button></div>{removeSlot && <Dialog title="Remove movement?" onClose={() => setRemoveSlot(undefined)} actions={<><Button variant="secondary" onClick={() => setRemoveSlot(undefined)}>Cancel</Button><Button variant="danger" onClick={removeConfirmed}>Remove from session</Button></>}><p>Remove {catalogById.get(removeSlot.exerciseId)?.name ?? removeSlot.exerciseId} from future {workoutKey} sessions?</p></Dialog>}</div>
}
