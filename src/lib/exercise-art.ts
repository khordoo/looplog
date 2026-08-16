const exerciseArtIds = new Set([
  'lower-front-squat-band',
  'upper-row-seated-feet',
  'lower-rdl-band',
  'upper-pushup-band',
  'upper-press-overhead-band',
  'core-dead-bug',
  'lower-reverse-lunge',
  'upper-floor-press-band',
  'lower-good-morning-band',
  'upper-row-bentover-band',
  'upper-pull-apart-band',
  'core-side-plank',
  'lower-split-squat',
  'lower-single-leg-rdl-supported',
  'upper-curl-band',
  'lower-calf-raise',
  'core-bird-dog',
])

export function exerciseArtFor(exerciseId: string): string | undefined {
  return exerciseArtIds.has(exerciseId) ? `/exercises/${exerciseId}.webp` : undefined
}

export const illustratedExerciseIds = [...exerciseArtIds]
