import { describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  createBackupEnvelope,
  mergeBackupData,
  parseBackup,
  previewBackup,
  replaceBackupData,
  serializeBackup,
  validateBackupData,
} from './backup'
import type { AppMeta, BackupData, Band, Profile, SetLog, Substitution, WorkoutSession } from '../types'

const now = '2026-08-16T12:00:00.000Z'
const profile: Profile = {
  id: 'profile', createdAt: now, updatedAt: now, timezone: 'America/Toronto', daysPerWeek: 3,
  mode: 'flexible', fixedWeekdays: [], planVersion: '1', onboardingCompleted: true, safetyAcknowledged: true,
}
const band: Band = {
  id: 'band-1', key: 'serious-steel-1', brand: 'Serious Steel', lengthInches: 41, number: 1, displayColor: 'purple', nominalMinLb: 5, nominalMaxLb: 35, enabled: true, createdAt: now, updatedAt: now,
}
const session: WorkoutSession = {
  id: 'session-1', createdAt: now, updatedAt: now, workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16', status: 'completed', completedAt: now,
}
const substitution: Substitution = {
  id: 'substitution-1', createdAt: now, updatedAt: now, planSlotId: 'A-1', originalExerciseId: 'squat', selectedExerciseId: 'lunge',
}
const setLog: SetLog = {
  id: 'set-log-1', createdAt: now, updatedAt: now, exerciseLogId: 'exercise-log-1', setNumber: 1, reps: 10, bandKeys: [band.key], effort: 'just-right', completedAt: now,
}
const appMeta: AppMeta = {
  id: 'app', createdAt: now, updatedAt: now, databaseVersion: 2, dismissedNotices: [],
}
const data: BackupData = {
  profile, bands: [band], substitutions: [substitution], sessions: [session], appMeta,
  exerciseLogs: [{ id: 'exercise-log-1', createdAt: now, updatedAt: now, sessionId: session.id, exerciseId: 'squat', planSlotId: 'A-1', order: 0, targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [band.key], source: 'default' } }],
  setLogs: [setLog],
}

describe('backup envelope', () => {
  it('round trips a readable deterministic envelope with a checksum and preview', async () => {
    const serialized = await serializeBackup(data, { appVersion: '0.1.0', exportedAt: now })
    expect(serialized).toContain('"schemaVersion": 1')
    const parsed = await parseBackup(serialized)
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(parsed.sessions[0].id).toBe(session.id)
    const preview = await previewBackup(serialized)
    expect(preview).toMatchObject({ workoutCount: 1, dateRange: { from: session.scheduledDate, to: session.scheduledDate }, bands: [band.key] })
  })

  it('round trips resumable active state and rejects unknown nested state keys', async () => {
    const resumable = { ...data, sessions: [{ ...session, status: 'in-progress' as const, activeState: { phase: 'working' as const, activeExerciseIndex: 2, draft: { reps: '10', bandKeys: ['serious-steel-1'], setupAdjustment: 'other' as const, setupNote: 'short anchor', effort: 'just-right' as const }, restTimerSeconds: 42, restTimerRunning: true } }] }
    const envelope = await createBackupEnvelope(resumable, { appVersion: '0.1.0', exportedAt: now })
    expect((await parseBackup(envelope)).sessions[0].activeState?.activeExerciseIndex).toBe(2)
    await expect(parseBackup({ ...envelope, sessions: [{ ...envelope.sessions[0], activeState: { ...envelope.sessions[0].activeState, unexpected: true } }] })).rejects.toThrow(/unsupported field/i)
  })

  it('accepts a linked runtime accessory log but never an accessory substitution', () => {
    const accessoryData = { ...data, exerciseLogs: [{ ...data.exerciseLogs[0], planSlotId: 'C-5-accessory' }] }
    expect(() => validateBackupData(accessoryData, { knownPlanSlotIds: ['A-1', 'C-5'] })).not.toThrow()
    expect(() => validateBackupData({ ...data, substitutions: [{ ...substitution, planSlotId: 'C-5-accessory' }] }, { knownPlanSlotIds: ['A-1', 'C-5'] })).toThrow(/accessory/i)
  })

  it('rejects malformed, future-version, checksum-invalid, duplicate, referential, and unknown-field files', async () => {
    await expect(parseBackup('{not json')).rejects.toThrow(/valid JSON/i)
    const envelope = await createBackupEnvelope(data, { appVersion: '0.1.0', exportedAt: now })
    await expect(parseBackup({ ...envelope, schemaVersion: BACKUP_SCHEMA_VERSION + 1 })).rejects.toThrow(/newer/i)
    await expect(parseBackup({ ...envelope, checksum: { ...envelope.checksum, value: '0'.repeat(64) } })).rejects.toThrow(/checksum/i)
    await expect(parseBackup({ ...envelope, sessions: [{ ...session, status: 'skipped' }] })).rejects.toThrow(/checksum/i)
    await expect(parseBackup({ ...envelope, unexpected: true })).rejects.toThrow(/unsupported field/i)
    await expect(parseBackup({ ...envelope, bands: [band, band] })).rejects.toThrow(/duplicate band/i)
    await expect(parseBackup({ ...envelope, bands: [band, { ...band, id: 'band-2' }] })).rejects.toThrow(/duplicate band key/i)
    await expect(parseBackup({ ...envelope, substitutions: [substitution, { ...substitution, id: 'substitution-2' }] })).rejects.toThrow(/duplicate substitution key/i)
    await expect(parseBackup({ ...envelope, setLogs: [{ ...setLog, bandKeys: ['missing-band'] }] })).rejects.toThrow(/missing band/i)
    await expect(parseBackup({ ...envelope, exerciseLogs: [{ ...data.exerciseLogs[0], sessionId: 'missing' }] })).rejects.toThrow(/missing session/i)
  })

  it('merges by stable identity and keeps the latest updated record', () => {
    const newerBand = { ...band, updatedAt: '2026-08-17T00:00:00.000Z', nickname: 'Heavy' }
    const incoming: BackupData = { ...data, bands: [newerBand], sessions: [{ ...session, id: 'session-2', scheduledDate: '2026-08-17', updatedAt: '2026-08-17T00:00:00.000Z' }] }
    const result = mergeBackupData(data, incoming)
    expect(result.data.bands[0].nickname).toBe('Heavy')
    expect(result.data.sessions).toHaveLength(2)
    expect(result.report.updated).toBeGreaterThan(0)
    expect(result.report.inserted).toBeGreaterThan(0)
  })

  it('counts singleton insertions, updates, and skips in merge reports', () => {
    const empty: BackupData = { bands: [], substitutions: [], sessions: [], exerciseLogs: [], setLogs: [] }
    expect(mergeBackupData(empty, data).report).toMatchObject({ inserted: 7, updated: 0, skipped: 0 })
    expect(mergeBackupData(data, data).report).toMatchObject({ inserted: 0, updated: 0, skipped: 7 })
  })

  it('prepares a validated, detached replacement without mutating the source', () => {
    const replacement = replaceBackupData(data)
    expect(replacement).toEqual(data)
    expect(replacement).not.toBe(data)
    replacement.sessions[0].notes = 'changed only in replacement'
    expect(data.sessions[0].notes).toBeUndefined()
  })
})
