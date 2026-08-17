import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOnline, useStorage } from '../../app/providers/AppProvider'
import { exercises } from '../../lib/content'
import { exercises as sourceExercises } from '../../content/exercises'
import { Card, Status } from '../../components/ui/Status'
import { WorkoutIcon } from '../../components/ui/WorkoutIcons'
import { exerciseArtFor } from '../../lib/exercise-art'
import { MovementPreview } from '../workout/MovementPreview'
import { sessionExerciseSlots } from '../sessions/SessionSummary'
import type { Exercise, PlanSlot, Profile, Substitution, WorkoutKey } from '../../domain/types'

export function ExerciseLibrary() {
  const storage = useStorage()
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState<Profile>()
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [catalog, setCatalog] = useState<Exercise[]>(exercises)
  const [resolvedSlots, setResolvedSlots] = useState<Partial<Record<WorkoutKey, PlanSlot[]>>>({})
  useEffect(() => {
    let cancelled = false
    void Promise.all([storage.getProfile(), storage.listSubstitutions(), storage.listExercises ? storage.listExercises() : Promise.resolve(exercises)]).then(async ([nextProfile, nextSubstitutions, records]) => {
      if (cancelled) return
      setProfile(nextProfile); setSubstitutions(nextSubstitutions); setCatalog(records)
      if (storage.resolvePlan) {
        const keys: WorkoutKey[] = nextProfile?.daysPerWeek === 2 ? ['A', 'B'] : ['A', 'B', 'C']
        const resolved = await Promise.all(keys.map((key) => storage.resolvePlan!(key)))
        if (!cancelled) setResolvedSlots(Object.fromEntries(resolved.map((plan) => [plan.workoutKey, plan.slots])) as Partial<Record<WorkoutKey, PlanSlot[]>>)
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [storage])
  const filtered = catalog.filter((exercise) => !exercise.archived && `${exercise.name} ${exercise.category} ${exercise.primaryMuscles.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const sessionKeys: WorkoutKey[] = profile?.daysPerWeek === 2 ? ['A', 'B'] : ['A', 'B', 'C']
  const weekdayName = (day: number | undefined) => day === undefined ? '' : new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + day))
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">See it. Then move.</p><h2>Exercises</h2></div><span className="pill">{catalog.length} guides</span></div>
    <div className="library-actions"><Link className="button button-secondary" to="/exercises/custom/new">Create custom exercise</Link></div>
    {profile && <section className="your-sessions" aria-labelledby="your-sessions-heading"><div className="section-heading"><div><p className="eyebrow">Your plan</p><h3 id="your-sessions-heading">Your sessions</h3></div><span className="help">{profile.daysPerWeek}-day rotation</span></div><div className="session-card-grid">{sessionKeys.map((key, index) => { const slots = resolvedSlots[key] ?? sessionExerciseSlots(key, substitutions).map((item) => item.slot); const sessionSlots = slots.map((slot) => { const replacement = substitutions.find((item) => item.planSlotId === slot.id && !slot.isAccessory); const exerciseId = replacement?.selectedExerciseId ?? slot.exerciseId; return { exerciseId, exercise: catalog.find((item) => item.id === exerciseId), slot } }); return <article className="session-card" key={key}><div className="session-card-heading"><div><span className="session-letter">{key}</span><div><h3>Session {key}</h3>{profile.mode === 'fixed' && <p className="help">{weekdayName(profile.fixedWeekdays[index])}</p>}</div></div><span className="help">{sessionSlots.length} movements · ~30 min</span></div><div className="session-card-art" aria-hidden="true">{sessionSlots.slice(0, 4).map(({ exerciseId, exercise }) => { const art = exercise?.photoDataUrl ?? exerciseArtFor(exerciseId); return art ? <img key={exerciseId} src={art} alt="" width="640" height="640" loading="lazy" /> : <span key={exerciseId}><WorkoutIcon name="mobility" size={24} /></span> })}</div><p className="session-card-names">{sessionSlots.slice(0, 3).map(({ exercise, exerciseId }) => exercise?.name ?? exerciseId).join(' · ')}{sessionSlots.length > 3 ? ' · …' : ''}</p><Link className="button button-secondary" to={`/sessions/${key}`} data-testid={`view-session-${key}`}>View Session {key}</Link></article> })}</div></section>}
    <section aria-labelledby="all-exercises-heading"><div className="section-heading"><div><p className="eyebrow">Reference library</p><h3 id="all-exercises-heading">All exercises</h3></div></div><label className="search-label" htmlFor="exercise-search">Search exercises<input id="exercise-search" data-testid="exercise-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try row, squat, core…" /></label><p className="help" aria-live="polite">Showing {filtered.length} of {catalog.length} guides.</p>{filtered.length ? <div className="exercise-grid">{filtered.map((exercise) => { const art = exercise.photoDataUrl ?? exerciseArtFor(exercise.id); return <Link className="exercise-card" data-testid={`exercise-card-${exercise.id}`} to={`/exercises/${exercise.id}`} key={exercise.id}>{art ? <img src={art} alt="" width="640" height="640" loading="lazy" /> : <span className="exercise-card-fallback" aria-hidden="true"><WorkoutIcon name="mobility" size={34} /></span>}<span className="exercise-card-copy"><h3>{exercise.name}</h3><p>{exercise.isCustom ? 'Custom exercise' : exercise.category}</p><span>{exercise.primaryMuscles.slice(0, 2).join(' · ')}</span></span></Link> })}</div> : <Status kind="info">No exercises match “{query}”. Try another search.</Status>}</section></div>
}

export function ExerciseDetail() {
  const { exerciseId = '' } = useParams(); const online = useOnline(); const storage = useStorage(); const [video, setVideo] = useState(false); const [exercise, setExercise] = useState<Exercise | undefined>(() => exercises.find((item) => item.id === exerciseId))
  useEffect(() => { let cancelled = false; if (!storage.getExercise) return undefined; void storage.getExercise(exerciseId, { includeArchived: true }).then((record) => { if (!cancelled && record) setExercise(record) }).catch(() => undefined); return () => { cancelled = true } }, [exerciseId, storage])
  if (!exercise) return <div className="page"><Status kind="error">Exercise guide not found.</Status><Link to="/exercises" className="button button-primary">Back to exercises</Link></div>
  const source = exercise.isCustom ? undefined : sourceExercises.find((item) => item.id === exercise.id)
  const media = source?.media?.equipmentFit === 'needs-replacement' ? undefined : exercise.media
  return <div className="page" data-testid="exercise-guide"><Link to="/exercises" className="text-button">← All exercises</Link><div className="page-heading"><div><p className="eyebrow">{exercise.category}</p><h2>{exercise.name}</h2></div>{exercise.isCustom && <Link className="button button-secondary" to={`/exercises/custom/${exercise.id}`}>Edit custom exercise</Link>}</div>{exercise.archived && <Status kind="warning">Archived custom exercise · history remains readable.</Status>}{exercise.isCustom || media ? <MovementPreview exercise={exercise} online={online} showVideo={video} onShowVideo={() => setVideo(true)} guideLink={false} /> : <Status kind="warning">A demonstration is temporarily unavailable. The complete written guide remains available.</Status>}<div className="guide-grid"><Card><h3>Setup</h3><ul>{exercise.setup.map((item) => <li key={item}>{item}</li>)}</ul><h3>How to move</h3><ol>{exercise.steps.map((item) => <li key={item}>{item}</li>)}</ol><p><strong>Breathing and tempo:</strong> {exercise.breathingTempo}</p></Card><Card><h3>Form cues</h3><ul>{exercise.formCues.map((item) => <li key={item}>{item}</li>)}</ul><h3>Muscles</h3><p><strong>Primary:</strong> {exercise.primaryMuscles.join(', ') || 'Custom movement'}</p><p><strong>Secondary:</strong> {exercise.secondaryMuscles.join(', ') || '—'}</p><h3>Common mistakes</h3><ul>{exercise.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></Card></div><Card><h3>Make it easier or harder</h3><div className="two-col"><div><strong>Easier</strong><ul>{exercise.easierVariations.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Harder</strong><ul>{exercise.harderVariations.map((item) => <li key={item}>{item}</li>)}</ul></div></div><p><strong>Compatible substitution categories:</strong> {exercise.compatibleSubstitutionCategories.join(', ')}</p>{exercise.bandWarnings.length ? <Status kind="warning"><strong>Band safety:</strong> {exercise.bandWarnings.join(' ')}</Status> : null}</Card></div>
}
