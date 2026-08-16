import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOnline } from '../../app/providers/AppProvider'
import { exercises } from '../../lib/content'
import { exercises as sourceExercises } from '../../content/exercises'
import { Card, Status } from '../../components/ui/Status'
import { WorkoutIcon } from '../../components/ui/WorkoutIcons'
import { exerciseArtFor } from '../../lib/exercise-art'
import { MovementPreview } from '../workout/MovementPreview'

export function ExerciseLibrary() {
  const [query, setQuery] = useState('')
  const filtered = exercises.filter((exercise) => `${exercise.name} ${exercise.category} ${exercise.primaryMuscles.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">See it. Then move.</p><h2>Exercises</h2></div><span className="pill">{exercises.length} guides</span></div><label className="search-label" htmlFor="exercise-search">Search exercises<input id="exercise-search" data-testid="exercise-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try row, squat, core…" /></label><p className="help" aria-live="polite">Showing {filtered.length} of {exercises.length} guides.</p>{filtered.length ? <div className="exercise-grid">{filtered.map((exercise) => { const art = exerciseArtFor(exercise.id); return <Link className="exercise-card" data-testid={`exercise-card-${exercise.id}`} to={`/exercises/${exercise.id}`} key={exercise.id}>{art ? <img src={art} alt="" width="640" height="640" loading="lazy" /> : <span className="exercise-card-fallback" aria-hidden="true"><WorkoutIcon name="mobility" size={34} /></span>}<span className="exercise-card-copy"><h3>{exercise.name}</h3><p>{exercise.category}</p><span>{exercise.primaryMuscles.slice(0, 2).join(' · ')}</span></span></Link> })}</div> : <Status kind="info">No exercises match “{query}”. Try another search.</Status>}</div>
}

export function ExerciseDetail() {
  const { exerciseId = '' } = useParams(); const online = useOnline(); const [video, setVideo] = useState(false); const exercise = exercises.find((item) => item.id === exerciseId)
  if (!exercise) return <div className="page"><Status kind="error">Exercise guide not found.</Status><Link to="/exercises" className="button button-primary">Back to exercises</Link></div>
  const source = sourceExercises.find((item) => item.id === exercise.id)
  const media = source?.media?.equipmentFit === 'needs-replacement' ? undefined : exercise.media
  return <div className="page" data-testid="exercise-guide"><Link to="/exercises" className="text-button">← All exercises</Link><p className="eyebrow">{exercise.category}</p><h2>{exercise.name}</h2>{media ? <MovementPreview exercise={exercise} online={online} showVideo={video} onShowVideo={() => setVideo(true)} guideLink={false} /> : <Status kind="warning">A demonstration is temporarily unavailable. The complete written guide remains available.</Status>}<div className="guide-grid"><Card><h3>Setup</h3><ul>{exercise.setup.map((item) => <li key={item}>{item}</li>)}</ul><h3>How to move</h3><ol>{exercise.steps.map((item) => <li key={item}>{item}</li>)}</ol><p><strong>Breathing and tempo:</strong> {exercise.breathingTempo}</p></Card><Card><h3>Form cues</h3><ul>{exercise.formCues.map((item) => <li key={item}>{item}</li>)}</ul><h3>Muscles</h3><p><strong>Primary:</strong> {exercise.primaryMuscles.join(', ')}</p><p><strong>Secondary:</strong> {exercise.secondaryMuscles.join(', ')}</p><h3>Common mistakes</h3><ul>{exercise.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></Card></div><Card><h3>Make it easier or harder</h3><div className="two-col"><div><strong>Easier</strong><ul>{exercise.easierVariations.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Harder</strong><ul>{exercise.harderVariations.map((item) => <li key={item}>{item}</li>)}</ul></div></div><p><strong>Compatible substitution categories:</strong> {exercise.compatibleSubstitutionCategories.join(', ')}</p>{exercise.bandWarnings.length ? <Status kind="warning"><strong>Band safety:</strong> {exercise.bandWarnings.join(' ')}</Status> : null}</Card></div>
}
