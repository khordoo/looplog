import { describe, expect, it } from 'vitest'
import {
  CONTENT_VERSION,
  deskReset,
  exerciseById,
  exercises,
  hasOnlyProductionMedia,
  isProductionMedia,
  planExerciseIds,
  planPatterns,
  planReferencesResolve,
  planSlotIds,
  planTemplates,
  primaryExerciseIds,
  referencedExerciseIds,
  resolvePlan,
  unresolvedPlanExerciseIds,
  workingSlots,
} from './index'

const planKeys = ['A', 'B', 'C'] as const

describe('v1 static content', () => {
  it('contains the complete 22-item catalog with stable IDs', () => {
    expect(exercises).toHaveLength(22)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(22)
    expect(exercises.every((exercise) => exercise.contentVersion === CONTENT_VERSION)).toBe(true)
  })

  it('has all guide fields and rejects non-production media states', () => {
    expect(hasOnlyProductionMedia()).toBe(true)
    for (const exercise of exercises) {
      expect(exercise.setup.length).toBeGreaterThan(0)
      expect(exercise.steps.length).toBeGreaterThanOrEqual(2)
      expect(exercise.breathingTempo.length).toBeGreaterThan(0)
      expect(exercise.primaryMuscles.length).toBeGreaterThan(0)
      expect(exercise.secondaryMuscles.length).toBeGreaterThan(0)
      expect(exercise.formCues).toHaveLength(5)
      expect(exercise.commonMistakes.length).toBeGreaterThan(0)
      expect(exercise.easierVariations.length).toBeGreaterThan(0)
      expect(exercise.harderVariations.length).toBeGreaterThan(0)
      expect(exercise.bandWarnings.length).toBeGreaterThan(0)
      expect(exercise.compatibleSubstitutionCategories.length).toBeGreaterThan(0)
      expect(exercise.media.provider).toBe('youtube')
      expect(exercise.media.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      expect(exercise.media.url).toContain(exercise.media.videoId)
      expect(exercise.media.attribution).toContain('YouTube')
      expect(exercise.media.source.trim()).not.toMatch(/^(coaching demonstration|unknown|generic)$/i)
      expect(exercise.media.verifiedOn).toBe('2026-08-16')
      expect(exercise.media.lazy).toBe(true)
      expect(isProductionMedia(exercise.media)).toBe(true)
    }
  })

  it('gives every primary slot a globally unique A-1..C-6 ID separate from exercise IDs', () => {
    const expectedIds = planKeys.flatMap((key) => Array.from({ length: 6 }, (_, index) => `${key}-${index + 1}`))
    const actualIds = planKeys.flatMap((key) => planSlotIds(planTemplates[key]))
    expect(actualIds).toEqual(expectedIds)
    expect(new Set(actualIds).size).toBe(18)
    expect(actualIds.every((slotId) => !exercises.some((exercise) => exercise.id === slotId))).toBe(true)
  })

  it('keeps A/B/C at six primary slots in three pairs and resolves every reference', () => {
    for (const key of planKeys) {
      const plan = planTemplates[key]
      expect(plan.pairs).toHaveLength(3)
      expect(workingSlots(plan)).toHaveLength(6)
      expect(plan.initialSets).toBe(2)
      expect(plan.warmup.reduce((total, item) => total + item.seconds, 0)).toBe(240)
      expect(plan.cooldown.reduce((total, item) => total + item.seconds, 0)).toBeGreaterThan(0)
      expect(new Set(planSlotIds(plan)).size).toBe(6)
      expect(planReferencesResolve(plan)).toBe(true)
      expect(unresolvedPlanExerciseIds(plan)).toEqual([])
      for (const id of referencedExerciseIds(plan)) expect(exerciseById[id]).toBeDefined()
    }
  })

  it('models Workout C as six primary slots referencing seven exercise definitions', () => {
    const workoutC = planTemplates.C
    expect(workingSlots(workoutC)).toHaveLength(6)
    expect(primaryExerciseIds(workoutC)).toHaveLength(6)
    expect(planExerciseIds(workoutC)).toHaveLength(7)
    expect(new Set(planExerciseIds(workoutC)).size).toBe(7)
    expect(planExerciseIds(workoutC)).toEqual([
      'lower-split-squat',
      'upper-pushup-band',
      'lower-single-leg-rdl-supported',
      'upper-row-seated-feet',
      'upper-curl-band',
      'lower-calf-raise',
      'core-bird-dog',
    ])
    const c5 = workingSlots(workoutC)[4]
    const c6 = workingSlots(workoutC)[5]
    expect(c5.id).toBe('C-5')
    expect(c5.exerciseId).toBe('upper-curl-band')
    expect(c5.accessory).toEqual({ exerciseId: 'lower-calf-raise', target: { kind: 'reps', min: 10, max: 15 } })
    expect(c6.id).toBe('C-6')
    expect(c6.exerciseId).toBe('core-bird-dog')
  })

  it('covers the required movement patterns in both two- and three-day configurations', () => {
    const requiredForTwoDays = ['squat', 'hinge', 'push-horizontal', 'pull-horizontal', 'core'] as const
    const twoDayPatterns = new Set(resolvePlan(2).flatMap(planPatterns))
    for (const pattern of requiredForTwoDays) expect(twoDayPatterns.has(pattern)).toBe(true)

    const threeDayPatterns = new Set(resolvePlan(3).flatMap(planPatterns))
    for (const pattern of ['lunge', 'arms', 'calves'] as const) expect(threeDayPatterns.has(pattern)).toBe(true)
  })

  it('keeps the five-minute desk reset non-progressive and out of working plans', () => {
    expect(deskReset.durationMinutes).toBe(5)
    expect(deskReset.progression).toBe(false)
    expect(deskReset.items).toHaveLength(5)
    const workingIds = new Set(resolvePlan(3).flatMap(planExerciseIds))
    for (const id of deskReset.items) expect(workingIds.has(id)).toBe(false)
  })
})
