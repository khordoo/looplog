import type { ExerciseLog, SetLog, WorkoutSession } from './types'

export interface ExerciseSummary {
  exerciseId: string
  exerciseLogId: string
  order: number
  setsCompleted: number
  totalReps: number
  totalDurationSeconds: number
  complete: boolean
}

export interface WorkoutSummary {
  sessionId: string
  workoutKey: WorkoutSession['workoutKey']
  scheduledDate: WorkoutSession['scheduledDate']
  status: WorkoutSession['status']
  durationSeconds: number
  exercises: ExerciseSummary[]
  setsCompleted: number
  totalReps: number
  totalDurationSeconds: number
}

export interface ExerciseHistorySummary {
  exerciseId: string
  sessions: number
  completedSessions: number
  lastCompletedAt?: string
  totalReps: number
  totalDurationSeconds: number
  latest?: ExerciseSummary
}

export function summarizeWorkout(
  session: WorkoutSession,
  exerciseLogs: ExerciseLog[],
  setLogs: SetLog[],
): WorkoutSummary {
  const exercises = [...exerciseLogs]
    .sort((a, b) => a.order - b.order)
    .map((exerciseLog) => {
      const sets = setLogs.filter((set) => set.exerciseLogId === exerciseLog.id)
      const expectedSets = exerciseLog.targetSnapshot.sets
      return {
        exerciseId: exerciseLog.exerciseId,
        exerciseLogId: exerciseLog.id,
        order: exerciseLog.order,
        setsCompleted: sets.length,
        totalReps: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        totalDurationSeconds: sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0),
        complete: sets.length >= expectedSets,
      }
    })
  return {
    sessionId: session.id,
    workoutKey: session.workoutKey,
    scheduledDate: session.scheduledDate,
    status: session.status,
    durationSeconds: session.durationSeconds ?? 0,
    exercises,
    setsCompleted: exercises.reduce((sum, exercise) => sum + exercise.setsCompleted, 0),
    totalReps: exercises.reduce((sum, exercise) => sum + exercise.totalReps, 0),
    totalDurationSeconds: exercises.reduce((sum, exercise) => sum + exercise.totalDurationSeconds, 0),
  }
}

export function summarizeExerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
  exerciseLogs: ExerciseLog[],
  setLogs: SetLog[],
): ExerciseHistorySummary {
  const relevantLogs = exerciseLogs.filter((log) => log.exerciseId === exerciseId)
  const entries = relevantLogs
    .map((log) => {
      const session = sessions.find((item) => item.id === log.sessionId)
      if (!session) return undefined
      return { session, summary: summarizeWorkout(session, [log], setLogs).exercises[0] }
    })
    .filter((entry): entry is { session: WorkoutSession; summary: ExerciseSummary } => entry !== undefined)
  const summaries = entries.map((entry) => entry.summary)
  const completedSessions = new Set(relevantLogs
    .filter((log) => sessions.some((session) => session.id === log.sessionId && session.status === 'completed'))
    .map((log) => log.sessionId)).size
  const lastCompletedAt = sessions
    .filter((session) => session.status === 'completed' && relevantLogs.some((log) => log.sessionId === session.id))
    .map((session) => session.completedAt)
    .filter((date): date is string => date !== undefined)
    .sort()
    .at(-1)
  const latest = [...entries]
    .sort((a, b) => (a.session.completedAt ?? a.session.updatedAt).localeCompare(b.session.completedAt ?? b.session.updatedAt))
    .at(-1)?.summary
  return {
    exerciseId,
    sessions: summaries.length,
    completedSessions,
    lastCompletedAt,
    totalReps: summaries.reduce((sum, summary) => sum + summary.totalReps, 0),
    totalDurationSeconds: summaries.reduce((sum, summary) => sum + summary.totalDurationSeconds, 0),
    latest,
  }
}

export function summarizeHistory(sessions: WorkoutSession[], exerciseLogs: ExerciseLog[], setLogs: SetLog[]): WorkoutSummary[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))
    .map((session) => summarizeWorkout(session, exerciseLogs.filter((log) => log.sessionId === session.id), setLogs))
}
