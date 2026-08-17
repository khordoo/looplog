import { describe, expect, it } from 'vitest'
import { exerciseCatalog } from './exercises'
import { exerciseArtFor, illustratedExerciseIds } from '../lib/exercise-art'

describe('exercise art', () => {
  it('provides a local preview for every built-in exercise', () => {
    const exerciseIds = exerciseCatalog.map((exercise) => exercise.id)
    expect(exerciseIds.every((id) => exerciseArtFor(id)?.endsWith(`${id}.webp`))).toBe(true)
    expect(new Set(illustratedExerciseIds)).toEqual(new Set(exerciseIds))
    expect(illustratedExerciseIds).toHaveLength(exerciseIds.length)
  })
})
