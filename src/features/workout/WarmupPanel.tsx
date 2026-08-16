import type { ReactNode } from 'react'
import { WorkoutIcon } from '../../components/ui/WorkoutIcons'
import { Button } from '../../components/ui/Status'

const warmupMoves = [
  { icon: 'steps' as const, label: 'Easy march', cue: 'Wake up the feet', seconds: 60 },
  { icon: 'squat' as const, label: 'Comfortable squat', cue: 'Find an easy depth', seconds: 60 },
  { icon: 'mobility' as const, label: 'Shoulders & arms', cue: 'Retract and circle', seconds: 60 },
  { icon: 'hinge' as const, label: 'Hip hinge', cue: 'Push the hips back', seconds: 60 },
]

export function WarmupPanel({ workoutKey, onComplete, notice }: { workoutKey: string; onComplete: () => void; notice?: ReactNode }) {
  return <div className="page workout-page warmup-page">
    {notice}
    <div className="warmup-hero">
      <div className="warmup-heading"><span className="warmup-mark"><WorkoutIcon name="sparkles" size={26} /></span><div><p className="eyebrow">Workout {workoutKey} · warm-up</p><h2>Prepare to move</h2><p>Four easy moves. One minute each.</p></div></div>
      <div className="warmup-duration"><WorkoutIcon name="clock" size={18} /><strong>4:00</strong><span>total</span></div>
    </div>
    <div className="warmup-grid" aria-label="Four-minute warm-up">
      {warmupMoves.map((move, index) => <article className="warmup-move" key={move.label}><span className="warmup-number">0{index + 1}</span><span className="warmup-icon"><WorkoutIcon name={move.icon} size={25} /></span><div><strong>{move.label}</strong><span>{move.cue}</span></div><span className="warmup-time">{move.seconds}s</span></article>)}
    </div>
    <div className="warmup-ready"><div><WorkoutIcon name="shield" size={22} /><p><strong>Quick safety check</strong><span>Inspect your band and clear the floor before loading.</span></p></div><Button onClick={onComplete}>Start working sets <span aria-hidden="true">→</span></Button></div>
  </div>
}
