import { Link } from 'react-router-dom'
import type { Exercise } from '../../domain/types'
import { WorkoutIcon } from '../../components/ui/WorkoutIcons'
import { exerciseArtFor } from '../../lib/exercise-art'

interface MovementPreviewProps {
  exercise: Exercise
  online: boolean
  showVideo: boolean
  onShowVideo: () => void
  guideLink?: boolean
  compact?: boolean
}

export function MovementPreview({ exercise, online, showVideo, onShowVideo, guideLink = true, compact = false }: MovementPreviewProps) {
  const art = exerciseArtFor(exercise.id)
  const image = exercise.photoDataUrl ?? art
  return <section className={`movement-preview${compact ? ' movement-preview-compact' : ''}${online && showVideo ? ' movement-preview-video' : ''}`} aria-label={`${exercise.name} visual guide`} data-testid="movement-preview">
    <div className="movement-media">
      {online && showVideo && exercise.media
        ? <div className="video-frame"><iframe title={`${exercise.name} demonstration`} src={`https://www.youtube-nocookie.com/embed/${exercise.media.videoId}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
          : image
            ? <img src={image} alt={`${exercise.name} setup illustration`} width="640" height="640" loading={compact ? 'eager' : 'lazy'} />
          : <div className="movement-art-fallback"><WorkoutIcon name="sparkles" size={34} /><span>Visual guide</span></div>}
      {online && !showVideo && exercise.media && <button type="button" className="watch-demo" onClick={onShowVideo} aria-label={`Load ${exercise.name} demonstration video`} data-testid="load-video"><span className="play-disc"><WorkoutIcon name="play" size={18} /></span><span>Watch demo</span></button>}
      {!online && <span className="offline-video-badge">Offline · video unavailable</span>}
    </div>
    <div className="movement-glance">
      <p className="eyebrow"><WorkoutIcon name="sparkles" size={15} /> At a glance</p>
      <ul>{exercise.formCues.slice(0, 3).map((cue) => <li key={cue}><WorkoutIcon name="check" size={16} /><span>{cue}</span></li>)}</ul>
      <div className="movement-links">{guideLink && <Link to={`/exercises/${exercise.id}`}>Full guide</Link>}{exercise.media && <a href={exercise.media.sourceUrl} target="_blank" rel="noreferrer">Open on YouTube</a>}</div>
    </div>
    <p className="visual-caption">{exercise.isCustom ? (exercise.media ? 'User-supplied YouTube link' : 'Local custom exercise') : `${online ? 'Illustrated setup preview' : 'Video needs internet; the written guide remains available'} · Verified video by ${exercise.media?.sourceName ?? 'the exercise source'}`}</p>
  </section>
}
