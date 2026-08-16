import { describe, expect, it } from 'vitest'
import { assertValidSubstitution, isCompatibleSubstitution, validateSubstitution } from './substitutions'
import type { Exercise } from './types'

const item = (id: string, category: Exercise['category'], compatible: Exercise['category'][] = [category]): Exercise => ({
  id, contentVersion: '1', name: id, category, setup: [], steps: [], breathingTempo: '', primaryMuscles: [], secondaryMuscles: [],
  formCues: ['one'], commonMistakes: [], easierVariations: [], harderVariations: [], bandWarnings: [], compatibleSubstitutionCategories: compatible,
  defaultTarget: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('substitution validation', () => {
  it('allows only declared compatible movement categories', () => {
    const source = item('squat', 'squat', ['squat', 'lunge'])
    const candidate = item('lunge', 'lunge')
    expect(isCompatibleSubstitution(source, candidate)).toBe(true)
    expect(isCompatibleSubstitution(source, item('row', 'pull-horizontal'))).toBe(false)
  })

  it('rejects selecting the original exercise and exposes actionable errors', () => {
    const source = item('squat', 'squat')
    const result = validateSubstitution(source, source)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/different exercise/i)
    expect(() => assertValidSubstitution(source, source)).toThrow()
  })
})

