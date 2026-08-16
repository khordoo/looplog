import type {
  AppMeta,
  BackupData,
  Band,
  ExerciseLog,
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

export interface ImportReport {
  mode: 'merge' | 'replace'
  inserted: number
  updated: number
  skipped: number
  sessions: number
  dateRange?: { from: string; to: string }
}

export interface StorageStatus {
  persistentRequested: boolean
  persistentGranted?: boolean
  usageBytes?: number
  quotaBytes?: number
}

/**
 * The only persistence contract consumed by UI/features. Implementations
 * return domain records, never database-specific rows or table handles.
 */
export interface StorageAdapter {
  getProfile(): Promise<Profile | undefined>
  saveProfile(profile: Profile): Promise<void>

  getBands(): Promise<Band[]>
  replaceBands(bands: Band[]): Promise<void>

  listSubstitutions(): Promise<Substitution[]>
  saveSubstitution(substitution: Substitution): Promise<void>
  removeSubstitution(planSlotId: string): Promise<void>

  createSession(input: NewSession): Promise<WorkoutSession>
  getSession(sessionId: UUID): Promise<WorkoutSession | undefined>
  updateSession(session: WorkoutSession): Promise<void>
  /** Read/write only the resumable UI state; status and history remain untouched. */
  getSessionState?(sessionId: UUID): Promise<WorkoutSessionState | undefined>
  saveSessionState?(sessionId: UUID, state: WorkoutSessionState): Promise<void>
  listSessions(query?: SessionQuery): Promise<WorkoutSession[]>

  createExerciseLog(input: NewExerciseLog): Promise<ExerciseLog>
  updateExerciseLog?(log: ExerciseLog): Promise<void>
  getExerciseLogs(sessionId: UUID): Promise<ExerciseLog[]>

  createSetLog(input: NewSetLog): Promise<SetLog>
  updateSetLog(log: SetLog): Promise<void>
  getSetLogs(exerciseLogId: UUID): Promise<SetLog[]>
  listRecentPerformance(exerciseId: string, limit?: number): Promise<PerformanceRecord[]>

  exportData(): Promise<BackupData>
  importData(mode: 'merge' | 'replace', data: BackupData): Promise<ImportReport>

  getAppMeta(): Promise<AppMeta | undefined>
  saveAppMeta(meta: AppMeta): Promise<void>
  getStorageStatus?(): Promise<StorageStatus>
  resetAllData(): Promise<void>
}
