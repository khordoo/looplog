import { describe, expect, it } from 'vitest'
import { backupEnvelopeSchema, bandSchema, profileSchema, repRangeSchema, scheduleSettingsSchema, targetSnapshotSchema } from './types'

describe('domain schemas', () => {
  it('requires exactly one kind of target measurement', () => {
    const base = { sets: 2, bandKeys: [], source: 'default' as const }
    expect(targetSnapshotSchema.safeParse({ ...base, repRange: { min: 8, max: 12 } }).success).toBe(true)
    expect(targetSnapshotSchema.safeParse({ ...base }).success).toBe(false)
    expect(targetSnapshotSchema.safeParse({ ...base, repRange: { min: 8, max: 12 }, durationSeconds: { min: 30, max: 60 } }).success).toBe(false)
    expect(repRangeSchema.safeParse({ min: 13, max: 12 }).success).toBe(false)
  })

  it('rejects duplicate and incorrectly sized fixed weekday selections', () => {
    const base = { timezone: 'America/Toronto', mode: 'fixed' as const, daysPerWeek: 2 as const }
    expect(scheduleSettingsSchema.safeParse({ ...base, fixedWeekdays: [2, 2] }).success).toBe(false)
    expect(scheduleSettingsSchema.safeParse({ ...base, fixedWeekdays: [2] }).success).toBe(false)
    expect(profileSchema.safeParse({ id: 'profile', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', planVersion: '1', onboardingCompleted: true, safetyAcknowledged: true, ...base, fixedWeekdays: [2, 2] }).success).toBe(false)
  })

  it('rejects future or malformed backup shapes at the runtime boundary', () => {
    expect(backupEnvelopeSchema.safeParse({ schemaVersion: 99 }).success).toBe(false)
  })

  it('rejects an inverted nominal band range', () => {
    const stamp = '2026-01-01T00:00:00.000Z'
    expect(bandSchema.safeParse({ id: 'band', key: 'band', brand: 'Brand', lengthInches: 41, number: 1, displayColor: 'red', nominalMinLb: 50, nominalMaxLb: 10, enabled: true, createdAt: stamp, updatedAt: stamp }).success).toBe(false)
  })
})
