import { describe, expect, it } from 'vitest'
import { isBackupReminderDue } from './Today'
import type { AppMeta, WorkoutSession } from '../../domain/types'

const stamp = '2026-08-01T12:00:00.000Z'
function session(id: string, completedAt: string): WorkoutSession {
  return { id, createdAt: completedAt, updatedAt: completedAt, workoutKey: 'A', planVersion: 'v1', scheduledDate: completedAt.slice(0, 10) as `${number}-${number}-${number}`, status: 'completed', completedAt }
}
const meta: AppMeta = { id: 'app', createdAt: stamp, updatedAt: stamp, databaseVersion: 3, dismissedNotices: [], lastSuccessfulExportAt: stamp }

describe('backup reminder threshold', () => {
  it('prompts after the first completion when no export exists', () => {
    expect(isBackupReminderDue([session('one', stamp)], undefined, new Date(stamp))).toBe(true)
  })
  it('prompts after seven days or five additional completed workouts', () => {
    expect(isBackupReminderDue([session('one', stamp)], meta, new Date('2026-08-08T12:01:00.000Z'))).toBe(true)
    const five = Array.from({ length: 5 }, (_, index) => session(`new-${index}`, `2026-08-02T12:0${index}:00.000Z`))
    expect(isBackupReminderDue(five, meta, new Date('2026-08-03T12:00:00.000Z'))).toBe(true)
  })
  it('does not prompt before either post-export threshold', () => {
    expect(isBackupReminderDue([session('one', stamp)], meta, new Date('2026-08-02T12:00:00.000Z'))).toBe(false)
  })
})
