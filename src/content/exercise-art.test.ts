import { describe, expect, it } from 'vitest'
import { plan } from '../lib/content'
import { exerciseArtFor, illustratedExerciseIds } from '../lib/exercise-art'

describe('exercise art', () => {
  it('provides a local preview for every exercise used by the workout plans', () => {
    const workoutIds = new Set(Object.values(plan.workouts).flat().map((slot) => slot.exerciseId))
    expect([...workoutIds].every((id) => exerciseArtFor(id)?.endsWith(`${id}.webp`))).toBe(true)
    expect(illustratedExerciseIds).toHaveLength(workoutIds.size)
  })
})
