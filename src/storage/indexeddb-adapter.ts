import { TrainingTrackerDB, DATABASE_NAME, DATABASE_VERSION } from './db'
import type {
  AppMeta,
  BackupData,
  Band,
  CustomExercise,
  Exercise,
  ExerciseLog,
  ExercisePerformanceSet,
  ISOInstant,
  NewCustomExercise,
  NewExerciseLog,
  NewSession,
  NewSetLog,
  PerformanceRecord,
  Profile,
  PlanConfiguration,
  SessionQuery,
  SetLog,
  Substitution,
  UUID,
  WorkoutSession,
  WorkoutSessionState,
  ResolvedPlan,
} from '../domain/types'
import { createDefaultWorkoutSessionState, normalizePlanSlot, normalizeTargetSnapshot } from '../domain/types'
import type { ImportReport, StorageAdapter, StorageStatus } from './adapter'
import { mergeBackupData, replaceBackupData, validateBackupData } from '../domain/backup/backup'
import { materializePlanConfiguration, normalizePlanConfiguration, planVersionFor, resolvePlanConfiguration, targetSnapshotForSlot } from '../domain/plan-configurations'
import { customExerciseToExercise, validateCustomExercise } from '../domain/custom-exercises'
import { exercises as builtinExercises } from '../lib/content'

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

  async listPlanConfigurations(): Promise<PlanConfiguration[]> {
    return (await this.db.planConfigurations.toArray()).map((configuration) => normalizePlanConfiguration(clone(configuration)))
  }

  async getPlanConfiguration(workoutKey: 'A' | 'B' | 'C'): Promise<PlanConfiguration | undefined> {
    const configuration = await this.db.planConfigurations.get(workoutKey)
    return configuration ? normalizePlanConfiguration(clone(configuration)) : undefined
  }

  async savePlanConfiguration(configuration: PlanConfiguration): Promise<void> {
    let normalized = normalizePlanConfiguration(clone(configuration))
    const existing = await this.db.planConfigurations.get(normalized.id)
    if (existing && existing.revision > normalized.revision) throw new Error('Plan configuration is stale; reload before saving.')
    if (existing && existing.revision === normalized.revision) {
      const comparable = (value: PlanConfiguration) => JSON.stringify({ workoutKey: value.workoutKey, sourceVersion: value.sourceVersion, slots: value.slots, warmupMinutes: value.warmupMinutes, cooldownMinutes: value.cooldownMinutes })
      if (comparable(existing) === comparable(normalized)) return
      // The adapter owns revision assignment when an editor saves a copy that
      // did not increment its revision itself.
      normalized = { ...normalized, revision: existing.revision + 1, updatedAt: this.now() }
    }
    await this.db.planConfigurations.put(normalized)
  }

  async materializePlanConfiguration(workoutKey: 'A' | 'B' | 'C'): Promise<PlanConfiguration> {
    const existing = await this.db.planConfigurations.get(workoutKey)
    if (existing) return normalizePlanConfiguration(clone(existing))
    const substitutions = await this.db.substitutions.toArray()
    const configuration = materializePlanConfiguration(workoutKey, substitutions, this.now())
    await this.db.transaction('rw', [this.db.planConfigurations, this.db.substitutions], async () => {
      const raced = await this.db.planConfigurations.get(workoutKey)
      if (!raced) {
        await this.db.planConfigurations.put(clone(configuration))
        const slotIds = new Set(configuration.slots.map((slot) => slot.id))
        const legacy = substitutions.filter((substitution) => slotIds.has(substitution.planSlotId))
        if (legacy.length) await this.db.substitutions.bulkDelete(legacy.map((substitution) => substitution.planSlotId))
      }
    })
    return normalizePlanConfiguration(clone((await this.db.planConfigurations.get(workoutKey)) ?? configuration))
  }

  async restorePlanDefaults(workoutKey: 'A' | 'B' | 'C'): Promise<void> {
    const slotIds = new Set(materializePlanConfiguration(workoutKey, [], this.now()).slots.map((slot) => slot.id))
    await this.db.transaction('rw', [this.db.planConfigurations, this.db.substitutions], async () => {
      await this.db.planConfigurations.delete(workoutKey)
      const legacy = await this.db.substitutions.toArray()
      const remove = legacy.filter((substitution) => slotIds.has(substitution.planSlotId)).map((substitution) => substitution.planSlotId)
      if (remove.length) await this.db.substitutions.bulkDelete(remove)
    })
  }

  async resolvePlan(workoutKey: 'A' | 'B' | 'C'): Promise<ResolvedPlan> {
    const [configuration, substitutions] = await Promise.all([
      this.db.planConfigurations.get(workoutKey),
      this.db.substitutions.toArray(),
    ])
    return resolvePlanConfiguration(workoutKey, configuration ? clone(configuration) : undefined, substitutions)
  }

  async listCustomExercises(options: { includeArchived?: boolean } = {}): Promise<CustomExercise[]> {
    const rows = await this.db.customExercises.toArray()
    return rows.filter((exercise) => options.includeArchived || !exercise.archived).sort((a, b) => a.name.localeCompare(b.name)).map(clone)
  }

  async getCustomExercise(id: UUID, options: { includeArchived?: boolean } = {}): Promise<CustomExercise | undefined> {
    const row = await this.db.customExercises.get(id)
    if (!row || (row.archived && !options.includeArchived)) return undefined
    return clone(row)
  }

  async saveCustomExercise(input: CustomExercise | NewCustomExercise): Promise<CustomExercise> {
    const timestamp = this.now()
    const existing = 'id' in input && input.id ? await this.db.customExercises.get(input.id) : undefined
    const id = ('id' in input && input.id) ? input.id : this.idFactory()
    const record = validateCustomExercise({
      ...input,
      id,
      createdAt: existing?.createdAt ?? ('createdAt' in input ? input.createdAt : timestamp),
      updatedAt: timestamp,
    })
    await this.db.customExercises.put(clone(record))
    return clone(record)
  }

  async archiveCustomExercise(id: UUID): Promise<void> {
    const existing = await this.db.customExercises.get(id)
    if (!existing) throw new Error(`Cannot archive missing custom exercise ${id}.`)
    await this.db.customExercises.put(clone({ ...existing, archived: true, updatedAt: this.now() }))
  }

  async deleteCustomExercise(id: UUID): Promise<void> {
    const existing = await this.db.customExercises.get(id)
    if (!existing) return
    const used = await this.db.exerciseLogs.where('exerciseId').equals(id).count()
    const configured = (await this.db.planConfigurations.toArray()).some((configuration) => configuration.slots.some((slot) => slot.exerciseId === id))
    if (used > 0 || configured) {
      // “Delete” is intentionally an archive once history or a saved plan
      // depends on the record; this preserves old names and references.
      await this.db.customExercises.put(clone({ ...existing, archived: true, updatedAt: this.now() }))
      return
    }
    await this.db.customExercises.delete(id)
  }

  async listExercises(options: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
    const custom = await this.listCustomExercises(options)
    return [...builtinExercises.map(clone), ...custom.map(customExerciseToExercise)]
  }

  async getExercise(id: string, options: { includeArchived?: boolean } = {}): Promise<Exercise | undefined> {
    const builtin = builtinExercises.find((exercise) => exercise.id === id)
    if (builtin) return clone(builtin)
    const custom = await this.getCustomExercise(id, options)
    return custom ? customExerciseToExercise(custom) : undefined
  }

  async startSession(input: NewSession): Promise<WorkoutSession> {
    const resolved = await this.resolvePlan(input.workoutKey)
    const id = input.id ?? this.idFactory()
    return this.db.transaction('rw', [this.db.sessions, this.db.exerciseLogs, this.db.customExercises], async () => {
      const existingById = await this.db.sessions.get(id)
      if (existingById) return clone(existingById)
      const active = await this.db.sessions
        .where('workoutKey').equals(input.workoutKey)
        .filter((session) => session.scheduledDate === input.scheduledDate && (session.status === 'in-progress' || session.status === 'planned'))
        .first()
      if (active) {
        // A legacy active session may have no logs. Populate it once from the
        // resolved snapshot, but never rewrite a partially completed session.
        const existingLogs = await this.db.exerciseLogs.where('sessionId').equals(active.id).count()
        if (existingLogs === 0) await this.snapshotExerciseLogs(active.id, resolved, this.db.customExercises)
        return clone(active)
      }
      const timestamp = this.now()
      const session: WorkoutSession = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        workoutKey: input.workoutKey,
        planVersion: resolved.configuration ? planVersionFor(resolved.configuration) : resolved.version,
        scheduledDate: input.scheduledDate,
        status: 'in-progress',
        startedAt: input.startedAt ?? timestamp,
        notes: input.notes,
        activeState: clone(input.activeState ?? createDefaultWorkoutSessionState()),
      }
      await this.db.sessions.add(clone(session))
      await this.snapshotExerciseLogs(session.id, resolved, this.db.customExercises)
      return clone(session)
    })
  }

  private async snapshotExerciseLogs(sessionId: UUID, resolved: ResolvedPlan, customTable: { toArray(): Promise<CustomExercise[]> }): Promise<void> {
    const custom = await customTable.toArray()
    const customNames = new Map(custom.map((exercise) => [exercise.id, exercise.name]))
    const timestamp = this.now()
    const logs: ExerciseLog[] = resolved.slots.slice().sort((a, b) => a.order - b.order).map((slot, order) => ({
      id: this.idFactory(),
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId,
      exerciseId: slot.exerciseId,
      planSlotId: slot.id,
      order,
      targetSnapshot: targetSnapshotForSlot(normalizePlanSlot(slot)),
      exerciseNameSnapshot: customNames.get(slot.exerciseId) ?? builtinExercises.find((exercise) => exercise.id === slot.exerciseId)?.name,
    }))
    if (logs.length) await this.db.exerciseLogs.bulkAdd(logs.map(clone))
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
    const exercise = input.exerciseNameSnapshot ? undefined : await this.getExercise(input.exerciseId, { includeArchived: true })
    const log: ExerciseLog = {
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      planSlotId: input.planSlotId,
      order: input.order,
      targetSnapshot: normalizeTargetSnapshot(clone(input.targetSnapshot)),
      exerciseNameSnapshot: input.exerciseNameSnapshot ?? exercise?.name,
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
    const [profile, bands, substitutions, sessions, exerciseLogs, setLogs, planConfigurations, customExercises, appMeta] = await Promise.all([
      this.db.profile.get(PROFILE_ID),
      this.db.bands.toArray(),
      this.db.substitutions.toArray(),
      this.db.sessions.toArray(),
      this.db.exerciseLogs.toArray(),
      this.db.setLogs.toArray(),
      this.db.planConfigurations.toArray(),
      this.db.customExercises.toArray(),
      this.db.appMeta.get(APP_META_ID),
    ])
    return clone({
      profile,
      bands,
      substitutions,
      sessions,
      exerciseLogs: exerciseLogs.map((log) => ({ ...log, targetSnapshot: normalizeTargetSnapshot(log.targetSnapshot) })),
      setLogs,
      planConfigurations: planConfigurations.map((configuration) => normalizePlanConfiguration(configuration)),
      customExercises,
      appMeta,
    })
  }

  async importData(mode: 'merge' | 'replace', incoming: BackupData): Promise<ImportReport> {
    const current = await this.exportData()
    incoming = validateBackupData(incoming, this.backupReferenceOptions(incoming, current))
    if (mode === 'merge') {
      const merged = mergeBackupData(current, incoming)
      const checked = validateBackupData(merged.data, this.backupReferenceOptions(merged.data, current))
      await this.writeData(checked, false)
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

  private backupReferenceOptions(incoming: BackupData, current: BackupData) {
    const builtinIds = builtinExercises.map((exercise) => exercise.id)
    const customIds = [...(incoming.customExercises ?? []), ...(current.customExercises ?? [])].map((exercise) => exercise.id)
    const configuredSlots = [...(incoming.planConfigurations ?? []), ...(current.planConfigurations ?? [])].flatMap((configuration) => configuration.slots.map((slot) => slot.id))
    const defaultSlots = builtinExercises.length ? ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6'] : []
    return {
      knownExerciseIds: new Set([...builtinIds, ...customIds]),
      knownPlanSlotIds: new Set([...defaultSlots, ...configuredSlots]),
    }
  }

  private async writeData(data: BackupData, replace: boolean): Promise<void> {
    await this.db.transaction('rw', [this.db.profile, this.db.bands, this.db.substitutions, this.db.sessions, this.db.exerciseLogs, this.db.setLogs, this.db.planConfigurations, this.db.customExercises, this.db.appMeta], async () => {
      if (replace) {
        await Promise.all([
          this.db.profile.clear(), this.db.bands.clear(), this.db.substitutions.clear(),
          this.db.sessions.clear(), this.db.exerciseLogs.clear(), this.db.setLogs.clear(), this.db.planConfigurations.clear(), this.db.customExercises.clear(), this.db.appMeta.clear(),
        ])
        this.replaceFailureInjector?.('after-clear')
      }
      await this.putIfPresent(this.db.profile, data.profile)
      if (data.bands.length) await this.db.bands.bulkPut(data.bands.map(clone))
      if (data.substitutions.length) await this.db.substitutions.bulkPut(data.substitutions.map(clone))
      if (data.sessions.length) await this.db.sessions.bulkPut(data.sessions.map((session) => clone(session.status === 'completed' || session.status === 'skipped' ? { ...session, activeState: undefined } : session)))
      if (data.exerciseLogs.length) await this.db.exerciseLogs.bulkPut(data.exerciseLogs.map((log) => clone({ ...log, targetSnapshot: normalizeTargetSnapshot(log.targetSnapshot) })))
      if (data.setLogs.length) await this.db.setLogs.bulkPut(data.setLogs.map(clone))
      if (data.planConfigurations?.length) await this.db.planConfigurations.bulkPut(data.planConfigurations.map((configuration) => normalizePlanConfiguration(configuration)))
      if (data.customExercises?.length) await this.db.customExercises.bulkPut(data.customExercises.map((exercise) => validateCustomExercise(exercise)))
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
    await this.db.transaction('rw', [this.db.profile, this.db.bands, this.db.substitutions, this.db.sessions, this.db.exerciseLogs, this.db.setLogs, this.db.planConfigurations, this.db.customExercises, this.db.appMeta], async () => {
      await Promise.all([
        this.db.profile.clear(), this.db.bands.clear(), this.db.substitutions.clear(),
        this.db.sessions.clear(), this.db.exerciseLogs.clear(), this.db.setLogs.clear(), this.db.planConfigurations.clear(), this.db.customExercises.clear(), this.db.appMeta.clear(),
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
    inserted: data.bands.length + data.substitutions.length + data.sessions.length + data.exerciseLogs.length + data.setLogs.length + (data.planConfigurations?.length ?? 0) + (data.customExercises?.length ?? 0) + (data.profile ? 1 : 0) + (data.appMeta ? 1 : 0),
    updated: 0,
    skipped: 0,
    sessions: data.sessions.length,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : undefined,
  }
}
