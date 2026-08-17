import { describe, expect, it } from 'vitest'
import { materializePlanConfiguration, planVersionFor, resolvePlanConfiguration, targetSnapshotForSlot } from './plan-configurations'
import type { Substitution } from './types'

const now = '2026-08-17T12:00:00.000Z'

describe('plan configuration resolution', () => {
  it('materializes stable default slots and folds a legacy substitution into the copy', () => {
    const substitution: Substitution = {
      id: 'sub-1', createdAt: now, updatedAt: now, planSlotId: 'A-1',
      originalExerciseId: 'lower-front-squat-band', selectedExerciseId: 'lower-reverse-lunge',
    }
    const configuration = materializePlanConfiguration('A', [substitution], now)
    expect(configuration.id).toBe('A')
    expect(configuration.slots[0]).toMatchObject({ id: 'A-1', exerciseId: 'lower-reverse-lunge', defaultSets: 2, restSeconds: 60 })
    expect(configuration.slots.map((slot) => slot.id)).toEqual(['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6'])
    expect(planVersionFor(configuration)).toBe('v1:A:1')
  })

  it('keeps immutable built-ins and resolves a missing config through legacy substitutions', () => {
    const substitution: Substitution = {
      id: 'sub-1', createdAt: now, updatedAt: now, planSlotId: 'B-2',
      originalExerciseId: 'upper-floor-press-band', selectedExerciseId: 'upper-pushup-band',
    }
    const resolved = resolvePlanConfiguration('B', undefined, [substitution])
    expect(resolved.slots.find((slot) => slot.id === 'B-2')?.exerciseId).toBe('upper-pushup-band')
    expect(resolved.version).toBe('v1:B:default')
  })

  it('always carries the planned rest into a workout target snapshot', () => {
    const configuration = materializePlanConfiguration('C', [], now)
    const target = targetSnapshotForSlot({ ...configuration.slots[0], defaultSets: 3, restSeconds: 90 }, 'manual')
    expect(target).toMatchObject({ sets: 3, restSeconds: 90, source: 'manual' })
  })
})
