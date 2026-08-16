import { TrainingTrackerDB, DATABASE_NAME, DATABASE_VERSION } from './db'
import type {
  AppMeta,
  BackupData,
  Band,
  ExerciseLog,
  ExercisePerformanceSet,
  ISOInstant,
  NewExerciseLog,
  NewSession,
  NewSetLog,
  PerformanceRecord,
  Profile,
  SessionQuery,
  SetLog,
  Substitution,
  UUID,
  WorkoutSession,
  WorkoutSessionState,
} from '../domain/types'
import { createDefaultWorkoutSessionState } from '../domain/types'
import type { ImportReport, StorageAdapter, StorageStatus } from './adapter'
import { mergeBackupData, replaceBackupData, validateBackupData } from '../domain/backup/backup'

export interface IndexedDbStorageOptions {
  db?: TrainingTrackerDB
  dbName?: string
  now?: () => ISOInstant
  idFactory?: () => UUID
  /** Test-only failure injection hook; production callers should omit it. */
  replaceFailureInjector?: (stage: 'after-clear' | 'before-commit') => void
}

const PROFILE_ID = 'profile' as const
const APP_META_ID = 'app' as const

function defaultNow(): ISOInstant {
  return new Date().toISOString()
}

function defaultId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure UUID generation is unavailable; refusing to create a non-UUID record identifier.')
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function asStatusArray(status: SessionQuery['status']): string[] | undefined {
  if (!status) return undefined
  return Array.isArray(status) ? status : [status]
}

function inDateRange(value: string, query: SessionQuery): boolean {
  return (!query.from || value >= query.from) && (!query.to || value <= query.to)
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  readonly db: TrainingTrackerDB
  private readonly now: () => ISOInstant
  private readonly idFactory: () => UUID
  private readonly replaceFailureInjector?: IndexedDbStorageOptions['replaceFailureInjector']

  constructor(options: IndexedDbStorageOptions = {}) {
    this.db = options.db ?? new TrainingTrackerDB(options.dbName ?? DATABASE_NAME)
    this.now = options.now ?? defaultNow
    this.idFactory = options.idFactory ?? defaultId
    this.replaceFailureInjector = options.replaceFailureInjector
  }

  async getProfile(): Promise<Profile | undefined> {
    const row = await this.db.profile.get(PROFILE_ID)
    return row ? clone(row) : undefined
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put(clone(profile))
  }

  async getBands(): Promise<Band[]> {
    return (await this.db.bands.toArray()).map(clone)
  }

  async replaceBands(bands: Band[]): Promise<void> {
    await this.db.transaction('rw', this.db.bands, async () => {
      await this.db.bands.clear()
      if (bands.length) await this.db.bands.bulkPut(bands.map(clone))
    })
  }

  async listSubstitutions(): Promise<Substitution[]> {
    return (await this.db.substitutions.toArray()).map(clone)
  }

  async saveSubstitution(substitution: Substitution): Promise<void> {
    await this.db.substitutions.put(clone(substitution))
  }

  async removeSubstitution(planSlotId: string): Promise<void> {
    await this.db.substitutions.delete(planSlotId)
  }

  async createSession(input: NewSession): Promise<WorkoutSession> {
    const id = input.id ?? this.idFactory()
    return this.db.transaction('rw', this.db.sessions, async () => {
      const existing = await this.db.sessions.get(id)
      if (existing) return clone(existing)
      const active = await this.db.sessions
        .where('workoutKey').equals(input.workoutKey)
        .filter((session) => session.scheduledDate === input.scheduledDate && (session.status === 'in-progress' || session.status === 'planned'))
        .first()
      if (active) return clone(active)
      const timestamp = this.now()
      const session: WorkoutSession = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        workoutKey: input.workoutKey,
        planVersion: input.planVersion,
        scheduledDate: input.scheduledDate,
        status: 'in-progress',
        startedAt: input.startedAt ?? timestamp,
        notes: input.notes,
        activeState: clone(input.activeState ?? createDefaultWorkoutSessionState()),
      }
      await this.db.sessions.add(clone(session))
      return clone(session)
    })
  }

  async getSession(sessionId: UUID): Promise<WorkoutSession | undefined> {
    const row = await this.db.sessions.get(sessionId)
    return row ? clone(row) : undefined
  }

  async updateSession(session: WorkoutSession): Promise<void> {
    const existing = await this.db.sessions.get(session.id)
    if (existing && (existing.status === 'completed' || existing.status === 'skipped') && session.status !== existing.status) {
      throw new Error('Completed or skipped sessions cannot be changed or resumed.')
    }
    await this.db.sessions.put(clone(session.status === 'completed' || session.status === 'skipped' ? { ...session, activeState: undefined } : session))
  }

  async deleteSession(sessionId: UUID): Promise<void> {
    await this.db.transaction('rw', [this.db.sessions, this.db.exerciseLogs, this.db.setLogs], async () => {
      const logs = await this.db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
      const logIds = logs.map((log) => log.id)
      if (logIds.length) await this.db.setLogs.where('exerciseLogId').anyOf(logIds).delete()
      await this.db.exerciseLogs.where('sessionId').equals(sessionId).delete()
      await this.db.sessions.delete(sessionId)
    })
  }

  async getSessionState(sessionId: UUID): Promise<WorkoutSessionState | undefined> {
    const session = await this.db.sessions.get(sessionId)
    return session?.activeState ? clone(session.activeState) : undefined
  }

  async saveSessionState(sessionId: UUID, state: WorkoutSessionState): Promise<void> {
    const session = await this.db.sessions.get(sessionId)
    if (!session) throw new Error(`Cannot save state for missing session ${sessionId}.`)
    if (session.status === 'completed' || session.status === 'skipped') throw new Error('Completed or skipped sessions cannot be resumed.')
    await this.db.sessions.put(clone({ ...session, activeState: state, updatedAt: this.now() }))
  }

  async listSessions(query: SessionQuery = {}): Promise<WorkoutSession[]> {
    const statuses = asStatusArray(query.status)
    const rows = await this.db.sessions.toArray()
    return rows
      .filter((session) => inDateRange(session.scheduledDate, query))
      .filter((session) => !statuses || statuses.includes(session.status))
      .sort((a, b) => (b.completedAt ?? b.scheduledDate).localeCompare(a.completedAt ?? a.scheduledDate))
      .slice(0, query.limit)
      .map(clone)
  }

  async createExerciseLog(input: NewExerciseLog): Promise<ExerciseLog> {
    const id = input.id ?? this.idFactory()
    const existing = await this.db.exerciseLogs.get(id)
    if (existing) return clone(existing)
    const session = await this.db.sessions.get(input.sessionId)
    if (!session) throw new Error(`Cannot log an exercise for missing session ${input.sessionId}.`)
    const timestamp = this.now()
    const log: ExerciseLog = {
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      planSlotId: input.planSlotId,
      order: input.order,
      targetSnapshot: clone(input.targetSnapshot),
      note: input.note,
    }
    await this.db.exerciseLogs.add(clone(log))
    return clone(log)
  }

  async getExerciseLogs(sessionId: UUID): Promise<ExerciseLog[]> {
    return (await this.db.exerciseLogs.where('sessionId').equals(sessionId).sortBy('order')).map(clone)
  }

  async updateExerciseLog(log: ExerciseLog): Promise<void> {
    const existing = await this.db.exerciseLogs.get(log.id)
    if (!existing) throw new Error(`Cannot update missing exercise log ${log.id}.`)
    await this.db.exerciseLogs.put(clone({ ...log, updatedAt: log.updatedAt ?? this.now() }))
  }

  async createSetLog(input: NewSetLog): Promise<SetLog> {
    const id = input.id ?? this.idFactory()
    return this.db.transaction('rw', this.db.setLogs, this.db.exerciseLogs, async () => {
      const existing = await this.db.setLogs.get(id)
      if (existing) return clone(existing)
      const exerciseLog = await this.db.exerciseLogs.get(input.exerciseLogId)
      if (!exerciseLog) throw new Error(`Cannot log a set for missing exercise log ${input.exerciseLogId}.`)
      const byNumber = await this.db.setLogs.where('[exerciseLogId+setNumber]').equals([input.exerciseLogId, input.setNumber]).first()
      if (byNumber) return clone(byNumber)
      const timestamp = input.completedAt ?? this.now()
      const log: SetLog = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        exerciseLogId: input.exerciseLogId,
        setNumber: input.setNumber,
        reps: input.reps,
        durationSeconds: input.durationSeconds,
        bandKeys: [...input.bandKeys],
        setupAdjustment: input.setupAdjustment,
        setupNote: input.setupNote,
        effort: input.effort,
        completedAt: timestamp,
      }
      await this.db.setLogs.add(clone(log))
      return clone(log)
    })
  }

  async updateSetLog(log: SetLog): Promise<void> {
    await this.db.setLogs.put(clone(log))
  }

  async getSetLogs(exerciseLogId: UUID): Promise<SetLog[]> {
    return (await this.db.setLogs.where('exerciseLogId').equals(exerciseLogId).sortBy('setNumber')).map(clone)
  }

  async listRecentPerformance(exerciseId: string, limit = 5): Promise<PerformanceRecord[]> {
    const sessions = await this.db.sessions.where('status').equals('completed').toArray()
    const results: PerformanceRecord[] = []
    for (const session of sessions) {
      const logs = await this.db.exerciseLogs.where('sessionId').equals(session.id).toArray()
      for (const log of logs.filter((item) => item.exerciseId === exerciseId)) {
        const setLogs = await this.db.setLogs.where('exerciseLogId').equals(log.id).sortBy('setNumber')
        const sets: ExercisePerformanceSet[] = setLogs.map((set) => ({
          reps: set.reps,
          durationSeconds: set.durationSeconds,
          effort: set.effort,
          bandKeys: [...set.bandKeys],
          setupAdjustment: set.setupAdjustment,
        }))
        results.push({
          exerciseId,
          sessionId: session.id,
          exerciseLogId: log.id,
          completedAt: session.completedAt ?? session.updatedAt,
          target: clone(log.targetSnapshot),
          sets,
        })
      }
    }
    return results
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit)
      .map(clone)
  }

  async exportData(): Promise<BackupData> {
    const [profile, bands, substitutions, sessions, exerciseLogs, setLogs, appMeta] = await Promise.all([
      this.db.profile.get(PROFILE_ID),
      this.db.bands.toArray(),
      this.db.substitutions.toArray(),
      this.db.sessions.toArray(),
      this.db.exerciseLogs.toArray(),
      this.db.setLogs.toArray(),
      this.db.appMeta.get(APP_META_ID),
    ])
    return clone({ profile, bands, substitutions, sessions, exerciseLogs, setLogs, appMeta })
  }

  async importData(mode: 'merge' | 'replace', incoming: BackupData): Promise<ImportReport> {
    incoming = validateBackupData(incoming)
    const current = await this.exportData()
    if (mode === 'merge') {
      const merged = mergeBackupData(current, incoming)
      await this.writeData(merged.data, false)
      return { mode, ...merged.report }
    }

    const replacement = replaceBackupData(incoming)
    const snapshot = current
    try {
      await this.writeData(replacement, true)
    } catch (error) {
      try {
        await this.writeData(snapshot, false)
      } catch (rollbackError) {
        throw new Error(`Import failed and automatic rollback failed: ${String(rollbackError)}`)
      }
      throw error
    }
    const report = summarizeImport(replacement)
    return { mode, ...report }
  }

  private async writeData(data: BackupData, replace: boolean): Promise<void> {
    await this.db.transaction('rw', [this.db.profile, this.db.bands, this.db.substitutions, this.db.sessions, this.db.exerciseLogs, this.db.setLogs, this.db.appMeta], async () => {
      if (replace) {
        await Promise.all([
          this.db.profile.clear(), this.db.bands.clear(), this.db.substitutions.clear(),
          this.db.sessions.clear(), this.db.exerciseLogs.clear(), this.db.setLogs.clear(), this.db.appMeta.clear(),
        ])
        this.replaceFailureInjector?.('after-clear')
      }
      await this.putIfPresent(this.db.profile, data.profile)
      if (data.bands.length) await this.db.bands.bulkPut(data.bands.map(clone))
      if (data.substitutions.length) await this.db.substitutions.bulkPut(data.substitutions.map(clone))
      if (data.sessions.length) await this.db.sessions.bulkPut(data.sessions.map((session) => clone(session.status === 'completed' || session.status === 'skipped' ? { ...session, activeState: undefined } : session)))
      if (data.exerciseLogs.length) await this.db.exerciseLogs.bulkPut(data.exerciseLogs.map(clone))
      if (data.setLogs.length) await this.db.setLogs.bulkPut(data.setLogs.map(clone))
      await this.putIfPresent(this.db.appMeta, data.appMeta)
      if (replace) this.replaceFailureInjector?.('before-commit')
    })
  }

  private async putIfPresent<T>(table: { put(value: T): Promise<unknown> }, value: T | undefined): Promise<void> {
    if (value) await table.put(clone(value))
  }

  async getAppMeta(): Promise<AppMeta | undefined> {
    const row = await this.db.appMeta.get(APP_META_ID)
    return row ? clone(row) : undefined
  }

  async saveAppMeta(meta: AppMeta): Promise<void> {
    await this.db.appMeta.put(clone({ ...meta, databaseVersion: Math.max(meta.databaseVersion, DATABASE_VERSION) }))
  }

  async getStorageStatus(): Promise<StorageStatus> {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    let persistentGranted: boolean | undefined
    if (storage?.persisted) persistentGranted = await storage.persisted()
    const estimate = storage?.estimate ? await storage.estimate() : undefined
    return {
      persistentRequested: Boolean(storage?.persist),
      persistentGranted,
      usageBytes: estimate?.usage,
      quotaBytes: estimate?.quota,
    }
  }

  async resetAllData(): Promise<void> {
    await this.db.transaction('rw', [this.db.profile, this.db.bands, this.db.substitutions, this.db.sessions, this.db.exerciseLogs, this.db.setLogs, this.db.appMeta], async () => {
      await Promise.all([
        this.db.profile.clear(), this.db.bands.clear(), this.db.substitutions.clear(),
        this.db.sessions.clear(), this.db.exerciseLogs.clear(), this.db.setLogs.clear(), this.db.appMeta.clear(),
      ])
    })
  }

  async close(): Promise<void> {
    this.db.close()
  }

  async deleteDatabase(): Promise<void> {
    await this.db.delete()
  }
}

export default IndexedDbStorageAdapter

function summarizeImport(data: BackupData): Omit<ImportReport, 'mode'> {
  const dates = data.sessions.map((session) => session.scheduledDate).sort()
  return {
    inserted: data.bands.length + data.substitutions.length + data.sessions.length + data.exerciseLogs.length + data.setLogs.length + (data.profile ? 1 : 0) + (data.appMeta ? 1 : 0),
    updated: 0,
    skipped: 0,
    sessions: data.sessions.length,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : undefined,
  }
}
