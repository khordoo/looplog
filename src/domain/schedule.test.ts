import { describe, expect, it } from 'vitest'
import {
  addLocalDays,
  getLocalDate,
  getLocalWeekday,
  resolveFixedSchedule,
  resolveFlexibleSchedule,
  resolveSchedule,
  validateScheduleSettings,
} from './schedule'
import type { ScheduleSettings, WorkoutSession } from './types'

const settings = (overrides: Partial<ScheduleSettings> = {}): ScheduleSettings => ({
  timezone: 'America/Toronto', daysPerWeek: 3, mode: 'flexible', fixedWeekdays: [], ...overrides,
})

const session = (overrides: Partial<WorkoutSession>): WorkoutSession => ({
  id: crypto.randomUUID(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  workoutKey: 'A', planVersion: '1', scheduledDate: '2026-01-01', status: 'completed', ...overrides,
})

describe('timezone-safe date helpers', () => {
  it('keeps Toronto midnight on the correct local date', () => {
    expect(getLocalDate('2026-03-08T04:59:59.000Z', 'America/Toronto')).toBe('2026-03-07')
    expect(getLocalDate('2026-03-08T05:00:00.000Z', 'America/Toronto')).toBe('2026-03-08')
    expect(getLocalWeekday('2026-03-08T05:00:00.000Z', 'America/Toronto')).toBe(0)
  })

  it('handles the repeated hour at the autumn DST transition', () => {
    expect(getLocalDate('2026-11-01T05:59:59.000Z', 'America/Toronto')).toBe('2026-11-01')
    expect(getLocalDate('2026-11-01T06:00:00.000Z', 'America/Toronto')).toBe('2026-11-01')
  })

  it('adds date-only days without machine-timezone drift', () => {
    expect(addLocalDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addLocalDays('2026-03-08', -1)).toBe('2026-03-07')
  })
})

describe('schedule validation and resolution', () => {
  it('validates exact fixed weekday counts for two and three days', () => {
    expect(validateScheduleSettings(settings({ daysPerWeek: 2, mode: 'fixed', fixedWeekdays: [2, 5] })).valid).toBe(true)
    expect(validateScheduleSettings(settings({ daysPerWeek: 3, mode: 'fixed', fixedWeekdays: [1, 3, 5] })).valid).toBe(true)
    expect(validateScheduleSettings(settings({ daysPerWeek: 3, mode: 'fixed', fixedWeekdays: [1, 3] })).valid).toBe(false)
  })

  it('uses A to B in two-day flexible mode and A to B to C in three-day mode', () => {
    const now = '2026-08-16T15:00:00.000Z'
    expect(resolveFlexibleSchedule({ settings: settings({ daysPerWeek: 2 }), now, sessions: [] }).next?.workoutKey).toBe('A')
    const twoDone = [session({ workoutKey: 'A', scheduledDate: '2026-08-15' })]
    expect(resolveFlexibleSchedule({ settings: settings({ daysPerWeek: 2 }), now, sessions: twoDone }).next?.workoutKey).toBe('B')
    const threeDone = [session({ workoutKey: 'A' }), session({ workoutKey: 'B' })]
    expect(resolveFlexibleSchedule({ settings: settings({ daysPerWeek: 3 }), now, sessions: threeDone }).next?.workoutKey).toBe('C')
  })

  it('does not create overdue debt in flexible mode after missed calendar days', () => {
    const decision = resolveFlexibleSchedule({ settings: settings({ daysPerWeek: 3 }), now: '2026-08-20T15:00:00.000Z', sessions: [] })
    expect(decision.next?.workoutKey).toBe('A')
    expect(decision.missed).toHaveLength(0)
  })

  it('resumes an in-progress session before resolving a new workout', () => {
    const inProgress = session({ status: 'in-progress', workoutKey: 'B', scheduledDate: '2026-08-10', updatedAt: '2026-08-12T00:00:00.000Z' })
    expect(resolveSchedule({ settings: settings(), now: '2026-08-16T15:00:00.000Z', sessions: [inProgress] }).resume?.id).toBe(inProgress.id)
  })

  it('finds fixed weekdays in order and does not shift future assignments after a missed date', () => {
    const fixed = settings({ mode: 'fixed', daysPerWeek: 3, fixedWeekdays: [1, 3, 5] })
    const decision = resolveFixedSchedule({ settings: fixed, now: '2026-08-20T16:00:00.000Z', trainingStartDate: '2026-08-01', sessions: [] })
    expect(decision.next).toMatchObject({ workoutKey: 'C', scheduledDate: '2026-08-21', weekday: 5 })
    expect(decision.missed.some((item) => item.scheduledDate === '2026-08-17' && item.workoutKey === 'A')).toBe(true)
  })

  it('does not report pre-onboarding debt for a brand-new fixed profile', () => {
    const fixed = settings({ mode: 'fixed', daysPerWeek: 2, fixedWeekdays: [2, 5] })
    const decision = resolveFixedSchedule({ settings: fixed, now: '2026-08-20T17:00:00.000Z', trainingStartDate: '2026-08-20', sessions: [] })
    expect(decision.missed).toHaveLength(0)
  })

  it('allows late completion of a missed fixed slot while retaining the next weekday slot', () => {
    const fixed = settings({ mode: 'fixed', daysPerWeek: 2, fixedWeekdays: [2, 5] })
    const missed = resolveFixedSchedule({ settings: fixed, now: '2026-08-20T17:00:00.000Z', trainingStartDate: '2026-08-17', sessions: [] })
    expect(missed.missed).toContainEqual({ workoutKey: 'A', scheduledDate: '2026-08-18', weekday: 2 })
    const completedLate = session({ workoutKey: 'A', scheduledDate: '2026-08-18', status: 'completed', completedAt: '2026-08-20T17:00:00.000Z' })
    const decision = resolveFixedSchedule({ settings: fixed, now: '2026-08-20T17:00:00.000Z', trainingStartDate: '2026-08-17', sessions: [completedLate] })
    expect(decision.missed.some((item) => item.scheduledDate === '2026-08-18')).toBe(false)
    expect(decision.next).toMatchObject({ workoutKey: 'B', scheduledDate: '2026-08-21' })
  })
})
