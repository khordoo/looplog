import Dexie, { type Table } from 'dexie'
import type {
  AppMeta,
  Band,
  CustomExercise,
  EntityMeta,
  ExerciseLog,
  PlanConfiguration,
  Profile,
  SetLog,
  Substitution,
  WorkoutSession,
} from '../domain/types'

export const DATABASE_NAME = 'training-tracker'
export const DATABASE_VERSION = 5

export type DbRow<T extends EntityMeta> = T

export class TrainingTrackerDB extends Dexie {
  profile!: Table<Profile, string>
  bands!: Table<Band, string>
  substitutions!: Table<Substitution, string>
  sessions!: Table<WorkoutSession, string>
  exerciseLogs!: Table<ExerciseLog, string>
  setLogs!: Table<SetLog, string>
  appMeta!: Table<AppMeta, string>
  planConfigurations!: Table<PlanConfiguration, string>
  customExercises!: Table<CustomExercise, string>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores({
      profile: 'id, updatedAt',
      bands: 'key, id, enabled, updatedAt',
      substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt',
      exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt',
      appMeta: 'id, updatedAt',
    })
    this.version(2).stores({
      profile: 'id, updatedAt',
      bands: 'key, id, enabled, updatedAt',
      substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt',
      exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt',
      appMeta: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      // Version 1 records predate the explicit update timestamp contract.
      // Backfill from createdAt without changing any identifiers or history.
      for (const tableName of ['profile', 'bands', 'substitutions', 'sessions', 'exerciseLogs', 'setLogs', 'appMeta']) {
        const table = transaction.table(tableName)
        const rows = await table.toArray() as Array<{ createdAt?: string; updatedAt?: string; [key: string]: unknown }>
        for (const row of rows) {
          if (!row.updatedAt && row.createdAt) await table.put({ ...row, updatedAt: row.createdAt })
        }
      }
    })
    this.version(3).stores({
      profile: 'id, updatedAt',
      bands: 'key, id, enabled, updatedAt',
      substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt',
      exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt',
      appMeta: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      // v2 sessions had no resumable UI state. Give only unfinished sessions a
      // safe initial state; completed/skipped records remain historical facts.
      const table = transaction.table('sessions')
      const rows = await table.toArray() as Array<Record<string, unknown>>
      for (const row of rows) {
        if (row.status === 'in-progress' && !row.activeState) {
          await table.put({
            ...row,
            activeState: {
              phase: 'warmup',
              activeExerciseIndex: 0,
              draft: { bandKeys: [], setupAdjustment: 'standard', effort: 'just-right' },
              restTimerSeconds: 60,
              restTimerRunning: false,
            },
          })
        }
      }
      const metaTable = transaction.table('appMeta')
      const metas = await metaTable.toArray() as Array<Record<string, unknown>>
      for (const meta of metas) {
        if (typeof meta.databaseVersion === 'number' && meta.databaseVersion < 3) {
          await metaTable.put({ ...meta, databaseVersion: 3 })
        }
      }
    })
    this.version(4).stores({
      profile: 'id, updatedAt',
      bands: 'key, id, enabled, updatedAt',
      substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt',
      exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt',
      appMeta: 'id, updatedAt',
      planConfigurations: 'id, workoutKey, updatedAt',
    })
    this.version(5).stores({
      profile: 'id, updatedAt',
      bands: 'key, id, enabled, updatedAt',
      substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt',
      exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt',
      appMeta: 'id, updatedAt',
      planConfigurations: 'id, workoutKey, updatedAt',
      customExercises: 'id, name, category, archived, updatedAt',
    }).upgrade(async (transaction) => {
      // Keep legacy records readable while adding the custom-content store. No
      // old history rows are rewritten here; name snapshots are additive.
      const metaTable = transaction.table('appMeta')
      const metas = await metaTable.toArray() as Array<Record<string, unknown>>
      for (const meta of metas) {
        if (typeof meta.databaseVersion === 'number' && meta.databaseVersion < 5) {
          await metaTable.put({ ...meta, databaseVersion: 5 })
        }
      }
    })
  }
}
