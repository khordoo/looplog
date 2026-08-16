import { describe, expect, it } from 'vitest'
import { summarizeExerciseHistory, summarizeWorkout } from './summaries'
import type { ExerciseLog, SetLog, WorkoutSession } from './types'

const session: WorkoutSession = {
  id: 'session-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:30:00.000Z', workoutKey: 'A', planVersion: '1', scheduledDate: '2026-01-01', status: 'completed', durationSeconds: 1800,
}
const log: ExerciseLog = {
  id: 'exercise-log-1', createdAt: '2026-01-01T00:01:00.000Z', updatedAt: '2026-01-01T00:20:00.000Z', sessionId: session.id, exerciseId: 'squat', planSlotId: 'A-1', order: 0,
  targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' },
}
const sets: SetLog[] = [
  { id: 'set-1', createdAt: '2026-01-01T00:10:00.000Z', updatedAt: '2026-01-01T00:10:00.000Z', exerciseLogId: log.id, setNumber: 1, reps: 10, bandKeys: [], effort: 'just-right', completedAt: '2026-01-01T00:10:00.000Z' },
  { id: 'set-2', createdAt: '2026-01-01T00:12:00.000Z', updatedAt: '2026-01-01T00:12:00.000Z', exerciseLogId: log.id, setNumber: 2, reps: 9, bandKeys: [], effort: 'just-right', completedAt: '2026-01-01T00:12:00.000Z' },
]

describe('history summaries', () => {
  it('summarizes completed sets without inventing missing values', () => {
    const result = summarizeWorkout(session, [log], sets)
    expect(result.setsCompleted).toBe(2)
    expect(result.totalReps).toBe(19)
    expect(result.exercises[0].complete).toBe(true)
    expect(result.durationSeconds).toBe(1800)
  })

  it('returns exercise-level history totals', () => {
    const result = summarizeExerciseHistory('squat', [session], [log], sets)
    expect(result.sessions).toBe(1)
    expect(result.completedSessions).toBe(1)
    expect(result.totalReps).toBe(19)
    expect(result.latest?.exerciseId).toBe('squat')
  })

  it('chooses the latest result by session completion time, not exercise order', () => {
    const older = session
    const newer: WorkoutSession = {
      ...session,
      id: 'session-2',
      updatedAt: '2026-01-03T00:30:00.000Z',
      completedAt: '2026-01-03T00:30:00.000Z',
      scheduledDate: '2026-01-03',
    }
    const newerLog: ExerciseLog = { ...log, id: 'exercise-log-2', sessionId: newer.id, updatedAt: '2026-01-03T00:20:00.000Z' }
    const newerSet: SetLog = { ...sets[0], id: 'set-3', exerciseLogId: newerLog.id, reps: 12 }
    const result = summarizeExerciseHistory('squat', [newer, older], [newerLog, log], [newerSet, ...sets])
    expect(result.latest?.exerciseLogId).toBe('exercise-log-2')
    expect(result.latest?.totalReps).toBe(12)
  })
})
