import { describe, expect, it } from 'vitest'
import { recommendNextTarget } from './progression'
import type { Exercise, ExercisePerformance, TargetSnapshot } from './types'

const target: TargetSnapshot = { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: ['serious-steel-1'], source: 'default' }
const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  contentVersion: '1', name: 'Band row', category: 'pull-horizontal',
  setup: ['Stand tall'], steps: ['Pull'], breathingTempo: 'Breathe steadily', primaryMuscles: ['back'], secondaryMuscles: [],
  formCues: ['Keep ribs down'], commonMistakes: ['Shrugging'], easierVariations: ['Lighter band'], harderVariations: ['Heavier band'],
  bandWarnings: [], compatibleSubstitutionCategories: ['pull-horizontal'], defaultTarget: target,
  id: 'band-row', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
})
const performance = (reps: number[], effort: ExercisePerformance['sets'][number]['effort'] = 'just-right', overrides: Partial<ExercisePerformance> = {}): ExercisePerformance => ({
  exerciseId: 'band-row', completedAt: '2026-01-02T00:00:00.000Z', target, sets: reps.map((value) => ({ reps: value, effort, bandKeys: ['serious-steel-1'] })), ...overrides,
})

describe('double progression', () => {
  it('maintains the default target without a previous performance', () => {
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [] }).kind).toBe('maintain')
  })

  it('suggests an extra rep within the range for a clean mid-range performance', () => {
    const result = recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([9, 10])] })
    expect(result.kind).toBe('increase-reps')
    expect(result.proposedTarget.suggestedReps).toBe(11)
  })

  it('requires two top-range performances before adding a third set', () => {
    const result = recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([12, 12]), performance([12, 12])] })
    expect(result.kind).toBe('add-set')
    expect(result.proposedTarget.sets).toBe(3)
  })

  it('suggests a harder setup after two top performances when already using three sets', () => {
    const threeSetTarget = { ...target, sets: 3 }
    const threeSetExercise = exercise({ defaultTarget: threeSetTarget })
    const top = performance([12, 12, 12], 'easy', { target: threeSetTarget })
    const result = recommendNextTarget({ exercise: threeSetExercise, previousPerformances: [top, top] })
    expect(result.kind).toBe('harder-setup')
  })

  it('maintains after one top-range performance and does not advance on max effort', () => {
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([12, 12])] }).kind).toBe('maintain')
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([12, 12], 'max-effort')] }).kind).toBe('maintain')
  })

  it('handles missed minimums, bodyweight reduction, and form breakdown', () => {
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([6, 8])] }).kind).toBe('easier-setup')
    const bodyweight = exercise({ defaultTarget: { ...target, bandKeys: [] } })
    expect(recommendNextTarget({ exercise: bodyweight, previousPerformances: [performance([6, 7], 'just-right', { target: bodyweight.defaultTarget })] }).kind).toBe('reduce-reps')
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [performance([10, 10], 'form-broke')] }).kind).toBe('regression')
  })

  it('does not count a top result at a different resistance as consecutive', () => {
    const prior = performance([12, 12])
    const latest = performance([12, 12], 'just-right', { target: { ...target, bandKeys: ['serious-steel-2'] } })
    expect(recommendNextTarget({ exercise: exercise(), previousPerformances: [latest, prior] }).kind).toBe('maintain')
  })
})
