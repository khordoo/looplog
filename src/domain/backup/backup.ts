import { backupDataSchema, backupEnvelopeSchema } from '../types'
import type { BackupData, BackupEnvelope, EntityMeta } from '../types'

// The envelope remains schema 1: activeState is an optional additive field,
// so old exports remain readable and the strict validator still rejects all
// unknown fields.
export const BACKUP_SCHEMA_VERSION = 1

export interface BackupBuildOptions {
  appVersion: string
  exportedAt?: string
}

export interface BackupPreview {
  exportDate: string
  appVersion: string
  schemaVersion: number
  workoutCount: number
  dateRange?: { from: string; to: string }
  bands: string[]
  substitutionCount: number
}

export interface BackupMergeReport {
  inserted: number
  updated: number
  skipped: number
  sessions: number
  dateRange?: { from: string; to: string }
}

export interface BackupMergeResult {
  data: BackupData
  report: BackupMergeReport
}

export interface BackupReferenceOptions {
  /** Optional static content IDs supplied by the import preview layer. */
  knownExerciseIds?: ReadonlySet<string> | readonly string[]
  knownPlanSlotIds?: ReadonlySet<string> | readonly string[]
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function sortBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((a, b) => key(a).localeCompare(key(b)))
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)]))
  }
  return value
}

function canonicalData(data: BackupData): BackupData {
  return {
    profile: data.profile ? clone(data.profile) : undefined,
    bands: sortBy(data.bands, (item) => item.key).map(clone),
    substitutions: sortBy(data.substitutions, (item) => item.planSlotId).map(clone),
    sessions: sortBy(data.sessions, (item) => item.id).map(clone),
    exerciseLogs: sortBy(data.exerciseLogs, (item) => item.id).map(clone),
    setLogs: sortBy(data.setLogs, (item) => item.id).map(clone),
    appMeta: data.appMeta ? clone(data.appMeta) : undefined,
  }
}

function payloadForChecksum(envelope: Omit<BackupEnvelope, 'checksum'>): string {
  return JSON.stringify(canonicalValue(envelope))
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('SHA-256 is unavailable in this browser.')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function rawObjectKeys(value: unknown): string[] {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : []
}

function assertExactKeys(value: unknown, expected: string[], path: string): void {
  const unknown = rawObjectKeys(value).filter((key) => !expected.includes(key))
  if (unknown.length) throw new Error(`Backup contains unsupported field(s) at ${path}: ${unknown.join(', ')}.`)
}

function assertStrictRawShape(raw: Record<string, unknown>): void {
  assertExactKeys(raw, ['schemaVersion', 'appVersion', 'exportedAt', 'checksum', 'profile', 'bands', 'substitutions', 'sessions', 'exerciseLogs', 'setLogs', 'appMeta'], 'backup')
  assertExactKeys(raw.checksum, ['algorithm', 'value'], 'checksum')
  const expected: Record<string, string[]> = {
    profile: ['id', 'createdAt', 'updatedAt', 'timezone', 'daysPerWeek', 'mode', 'fixedWeekdays', 'planVersion', 'onboardingCompleted', 'safetyAcknowledged'],
    band: ['id', 'createdAt', 'updatedAt', 'key', 'brand', 'lengthInches', 'number', 'displayColor', 'nominalMinLb', 'nominalMaxLb', 'enabled', 'nickname'],
    substitution: ['id', 'createdAt', 'updatedAt', 'planSlotId', 'originalExerciseId', 'selectedExerciseId'],
    session: ['id', 'createdAt', 'updatedAt', 'workoutKey', 'planVersion', 'scheduledDate', 'status', 'startedAt', 'completedAt', 'durationSeconds', 'notes', 'activeState'],
    exerciseLog: ['id', 'createdAt', 'updatedAt', 'sessionId', 'exerciseId', 'planSlotId', 'order', 'targetSnapshot', 'note'],
    setLog: ['id', 'createdAt', 'updatedAt', 'exerciseLogId', 'setNumber', 'reps', 'durationSeconds', 'bandKeys', 'setupAdjustment', 'setupNote', 'effort', 'completedAt'],
    appMeta: ['id', 'createdAt', 'updatedAt', 'databaseVersion', 'lastSuccessfulExportAt', 'installState', 'dismissedNotices', 'updateReady'],
    targetSnapshot: ['sets', 'repRange', 'durationSeconds', 'bandKeys', 'setupAdjustment', 'suggestedReps', 'progressionCue', 'source'],
    range: ['min', 'max'],
  }
  if (raw.profile) assertExactKeys(raw.profile, expected.profile, 'profile')
  for (const [name, values] of [['bands', raw.bands], ['substitutions', raw.substitutions], ['sessions', raw.sessions], ['exerciseLogs', raw.exerciseLogs], ['setLogs', raw.setLogs]] as const) {
    if (!Array.isArray(values)) continue
    const key = name === 'bands' ? 'band' : name === 'substitutions' ? 'substitution' : name === 'sessions' ? 'session' : name === 'exerciseLogs' ? 'exerciseLog' : 'setLog'
    values.forEach((item, index) => {
      assertExactKeys(item, expected[key], `${name}[${index}]`)
      if (key === 'exerciseLog') assertExactKeys((item as Record<string, unknown>).targetSnapshot, expected.targetSnapshot, `${name}[${index}].targetSnapshot`)
      if (key === 'exerciseLog') {
        const target = (item as Record<string, unknown>).targetSnapshot as Record<string, unknown> | undefined
        if (target?.repRange) assertExactKeys(target.repRange, expected.range, `${name}[${index}].targetSnapshot.repRange`)
        if (target?.durationSeconds) assertExactKeys(target.durationSeconds, expected.range, `${name}[${index}].targetSnapshot.durationSeconds`)
      }
      if (key === 'session') {
        const state = (item as Record<string, unknown>).activeState as Record<string, unknown> | undefined
        if (state) {
          assertExactKeys(state, ['phase', 'activeExerciseIndex', 'draft', 'restTimerSeconds', 'restTimerRunning'], `${name}[${index}].activeState`)
          assertExactKeys(state.draft, ['reps', 'durationSeconds', 'bandKeys', 'setupAdjustment', 'setupNote', 'effort'], `${name}[${index}].activeState.draft`)
        }
      }
    })
  }
  if (raw.appMeta) assertExactKeys(raw.appMeta, expected.appMeta, 'appMeta')
}

function assertUnique(values: Array<{ id: string }>, name: string): void {
  const ids = new Set<string>()
  for (const item of values) {
    if (ids.has(item.id)) throw new Error(`Backup contains duplicate ${name} identifier ${item.id}.`)
    ids.add(item.id)
  }
}

function assertUniqueLogicalKey<T>(values: T[], key: (value: T) => string, name: string): void {
  const keys = new Set<string>()
  for (const value of values) {
    const identity = key(value)
    if (keys.has(identity)) throw new Error(`Backup contains duplicate ${name} key ${identity}.`)
    keys.add(identity)
  }
}

function asSet(values: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> | undefined {
  return values instanceof Set ? values : values ? new Set(values) : undefined
}

function knownPlanSlot(set: ReadonlySet<string> | undefined, id: string): boolean {
  if (!set || set.has(id)) return true
  // Accessory logs are runtime snapshots linked to a primary content slot.
  // A caller that knows the six primary IDs can therefore validate the stable
  // C-5-accessory ID without maintaining a second content registry.
  return id.endsWith('-accessory') && set.has(id.slice(0, -'-accessory'.length))
}

function assertReferences(data: BackupData, options: BackupReferenceOptions = {}): void {
  assertUnique(data.bands, 'band')
  assertUniqueLogicalKey(data.bands, (item) => item.key, 'band')
  assertUnique(data.substitutions, 'substitution')
  assertUniqueLogicalKey(data.substitutions, (item) => item.planSlotId, 'substitution')
  assertUnique(data.sessions, 'session')
  assertUnique(data.exerciseLogs, 'exercise log')
  assertUnique(data.setLogs, 'set log')
  const sessions = new Set(data.sessions.map((item) => item.id))
  const exerciseLogs = new Set(data.exerciseLogs.map((item) => item.id))
  const bandKeys = new Set(data.bands.map((item) => item.key))
  const knownExerciseIds = asSet(options.knownExerciseIds)
  const knownPlanSlotIds = asSet(options.knownPlanSlotIds)
  for (const log of data.exerciseLogs) if (!sessions.has(log.sessionId)) throw new Error(`Exercise log ${log.id} references missing session ${log.sessionId}.`)
  for (const log of data.exerciseLogs) {
    if (knownExerciseIds && !knownExerciseIds.has(log.exerciseId)) throw new Error(`Exercise log ${log.id} references unknown exercise ${log.exerciseId}.`)
    if (knownPlanSlotIds && !knownPlanSlot(knownPlanSlotIds, log.planSlotId)) throw new Error(`Exercise log ${log.id} references unknown plan slot ${log.planSlotId}.`)
    for (const bandKey of log.targetSnapshot.bandKeys) if (!bandKeys.has(bandKey)) throw new Error(`Exercise log ${log.id} references missing band ${bandKey}.`)
  }
  for (const session of data.sessions) {
    for (const bandKey of session.activeState?.draft.bandKeys ?? []) if (!bandKeys.has(bandKey)) throw new Error(`Session ${session.id} draft references missing band ${bandKey}.`)
  }
  for (const log of data.setLogs) {
    if (!exerciseLogs.has(log.exerciseLogId)) throw new Error(`Set log ${log.id} references missing exercise log ${log.exerciseLogId}.`)
    for (const bandKey of log.bandKeys) if (!bandKeys.has(bandKey)) throw new Error(`Set log ${log.id} references missing band ${bandKey}.`)
  }
  for (const substitution of data.substitutions) {
    if (substitution.planSlotId.endsWith('-accessory')) throw new Error(`Substitution ${substitution.id} cannot target an accessory slot.`)
    if (knownExerciseIds && (!knownExerciseIds.has(substitution.originalExerciseId) || !knownExerciseIds.has(substitution.selectedExerciseId))) {
      throw new Error(`Substitution ${substitution.id} references unknown exercise content.`)
    }
    if (knownPlanSlotIds && !knownPlanSlot(knownPlanSlotIds, substitution.planSlotId)) throw new Error(`Substitution ${substitution.id} references unknown plan slot ${substitution.planSlotId}.`)
  }
}

export function validateBackupEnvelope(input: unknown, options: BackupReferenceOptions = {}): BackupEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Backup must be a JSON object.')
  const raw = input as Record<string, unknown>
  assertStrictRawShape(raw)
  const parsed = backupEnvelopeSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Backup validation failed: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  const envelope = parsed.data as BackupEnvelope
  if (envelope.schemaVersion > BACKUP_SCHEMA_VERSION) throw new Error(`Backup schema ${envelope.schemaVersion} is newer than this app supports.`)
  assertReferences(envelope, options)
  return clone(envelope)
}

export function validateBackupData(input: unknown, options: BackupReferenceOptions = {}): BackupData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Backup data must be an object.')
  const parsed = backupDataSchema.safeParse(input)
  if (!parsed.success) throw new Error(`Backup data validation failed: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  const data = parsed.data as BackupData
  assertReferences(data, options)
  return clone(data)
}

export async function createBackupEnvelope(data: BackupData, options: BackupBuildOptions): Promise<BackupEnvelope> {
  const validated = validateBackupData(data)
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const payload: Omit<BackupEnvelope, 'checksum'> = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: options.appVersion,
    exportedAt,
    ...canonicalData(validated),
  }
  const checksum = await sha256Hex(payloadForChecksum(payload))
  return { ...clone(payload), checksum: { algorithm: 'SHA-256', value: checksum } }
}

export async function serializeBackup(data: BackupData, options: BackupBuildOptions): Promise<string> {
  return JSON.stringify(await createBackupEnvelope(data, options), null, 2)
}

export async function parseBackup(input: string | unknown, options: BackupReferenceOptions = {}): Promise<BackupEnvelope> {
  const raw = typeof input === 'string' ? (() => {
    try { return JSON.parse(input) as unknown } catch { throw new Error('Backup is not valid JSON.') }
  })() : input
  const envelope = validateBackupEnvelope(raw, options)
  const payload = Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== 'checksum')) as Omit<BackupEnvelope, 'checksum'>
  const expected = await sha256Hex(payloadForChecksum(payload))
  if (!timingSafeEqual(expected, envelope.checksum.value)) throw new Error('Backup checksum is invalid; no data was changed.')
  return envelope
}

export const parseAndValidateBackup = parseBackup
export const buildBackupEnvelope = createBackupEnvelope
export const serializeBackupEnvelope = serializeBackup
export const validateAndVerifyBackup = parseBackup

export async function previewBackup(input: string | unknown): Promise<BackupPreview> {
  const envelope = await parseBackup(input)
  const dates = envelope.sessions.map((session) => session.scheduledDate).sort()
  return {
    exportDate: envelope.exportedAt,
    appVersion: envelope.appVersion,
    schemaVersion: envelope.schemaVersion,
    workoutCount: envelope.sessions.length,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : undefined,
    bands: envelope.bands.map((band) => band.nickname ? `${band.key} (${band.nickname})` : band.key),
    substitutionCount: envelope.substitutions.length,
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

function mergeRecords<T extends EntityMeta>(local: T[], incoming: T[], key: (value: T) => string, stats: { inserted: number; updated: number; skipped: number }): T[] {
  const result = new Map(local.map((item) => [key(item), clone(item)]))
  for (const item of incoming) {
    const identity = key(item)
    const existing = result.get(identity)
    if (!existing) {
      result.set(identity, clone(item)); stats.inserted += 1
    } else if (item.updatedAt > existing.updatedAt) {
      result.set(identity, clone(item)); stats.updated += 1
    } else {
      stats.skipped += 1
    }
  }
  return [...result.values()]
}

export function mergeBackupData(local: BackupData, incoming: BackupData): BackupMergeResult {
  const stats = { inserted: 0, updated: 0, skipped: 0 }
  let profile = local.profile
  if (!profile && incoming.profile) { profile = incoming.profile; stats.inserted += 1 }
  else if (profile && incoming.profile && incoming.profile.updatedAt > profile.updatedAt) { profile = incoming.profile; stats.updated += 1 }
  else if (profile && incoming.profile) stats.skipped += 1
  let appMeta = local.appMeta
  if (!appMeta && incoming.appMeta) { appMeta = incoming.appMeta; stats.inserted += 1 }
  else if (appMeta && incoming.appMeta && incoming.appMeta.updatedAt > appMeta.updatedAt) { appMeta = incoming.appMeta; stats.updated += 1 }
  else if (appMeta && incoming.appMeta) stats.skipped += 1
  const data: BackupData = {
    profile: profile ? clone(profile) : undefined,
    bands: mergeRecords(local.bands, incoming.bands, (item) => item.key, stats),
    substitutions: mergeRecords(local.substitutions, incoming.substitutions, (item) => item.planSlotId, stats),
    sessions: mergeRecords(local.sessions, incoming.sessions, (item) => item.id, stats),
    exerciseLogs: mergeRecords(local.exerciseLogs, incoming.exerciseLogs, (item) => item.id, stats),
    setLogs: mergeRecords(local.setLogs, incoming.setLogs, (item) => item.id, stats),
    appMeta: appMeta ? clone(appMeta) : undefined,
  }
  const dates = incoming.sessions.map((session) => session.scheduledDate).sort()
  return {
    data,
    report: {
      ...stats,
      sessions: incoming.sessions.length,
      dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : undefined,
    },
  }
}

export const mergeBackup = mergeBackupData

/** Pure replacement preparation: validate, canonicalize, and detach imported data before an adapter transaction. */
export function replaceBackupData(incoming: BackupData): BackupData {
  return canonicalData(validateBackupData(incoming))
}

export const replaceBackup = replaceBackupData
