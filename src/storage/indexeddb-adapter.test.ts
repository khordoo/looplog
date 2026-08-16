import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { IndexedDbStorageAdapter } from './indexeddb-adapter'
import type { Profile, WorkoutSessionState } from '../domain/types'

let sequence = 0
function uniqueDbName(): string { sequence += 1; return `training-tracker-test-${sequence}-${Date.now()}` }
const timestamp = '2026-08-16T12:00:00.000Z'
const profile: Profile = {
  id: 'profile', createdAt: timestamp, updatedAt: timestamp, timezone: 'America/Toronto', daysPerWeek: 3,
  mode: 'flexible', fixedWeekdays: [], planVersion: '1', onboardingCompleted: true, safetyAcknowledged: true,
}
function makeAdapter(dbName = uniqueDbName(), injector?: (stage: 'after-clear' | 'before-commit') => void): IndexedDbStorageAdapter {
  return new IndexedDbStorageAdapter({ dbName, now: () => timestamp, idFactory: (() => { let id = 0; return () => `id-${++id}` })(), replaceFailureInjector: injector })
}

async function cleanup(adapter: IndexedDbStorageAdapter): Promise<void> {
  await adapter.deleteDatabase()
}

describe('IndexedDbStorageAdapter', () => {
  it('starts fresh, persists profile/bands, and creates an in-progress session atomically', async () => {
    const adapter = makeAdapter()
    expect(await adapter.getProfile()).toBeUndefined()
    await adapter.saveProfile(profile)
    await adapter.replaceBands([])
    const session = await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    expect(session.status).toBe('in-progress')
    expect((await adapter.getProfile())?.id).toBe('profile')
    expect((await adapter.getSession(session.id))?.startedAt).toBe(timestamp)
    await cleanup(adapter)
  })

  it('uses a standards-compliant UUID and resumes an existing active session for duplicate starts', async () => {
    const adapter = new IndexedDbStorageAdapter({ dbName: uniqueDbName(), now: () => timestamp })
    const first = await adapter.createSession({ id: '11111111-1111-4111-8111-111111111111', workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const generated = await adapter.createSession({ workoutKey: 'B', planVersion: '1', scheduledDate: '2026-08-17' })
    expect(generated.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const duplicate = await adapter.createSession({ id: '22222222-2222-4222-8222-222222222222', workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    expect(duplicate.id).toBe(first.id)
    expect(await adapter.listSessions()).toHaveLength(2)
    await cleanup(adapter)
  })

  it('preserves history and backfills updatedAt during the explicit v1 to v2 migration', async () => {
    const dbName = uniqueDbName()
    const old = new Dexie(dbName)
    old.version(1).stores({
      profile: 'id, updatedAt', bands: 'key, id, enabled, updatedAt', substitutions: 'planSlotId, id, selectedExerciseId, updatedAt',
      sessions: 'id, workoutKey, scheduledDate, status, completedAt, updatedAt', exerciseLogs: 'id, sessionId, exerciseId, [sessionId+order], updatedAt',
      setLogs: 'id, exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt', appMeta: 'id, updatedAt',
    })
    await old.open()
    await old.table('sessions').put({ id: 'legacy-session', createdAt: timestamp, workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16', status: 'completed' })
    await old.table('sessions').put({ id: 'legacy-active', createdAt: timestamp, workoutKey: 'B', planVersion: '1', scheduledDate: '2026-08-17', status: 'in-progress' })
    await old.table('appMeta').put({ id: 'app', createdAt: timestamp, updatedAt: timestamp, databaseVersion: 2, dismissedNotices: [] })
    old.close()
    const adapter = new IndexedDbStorageAdapter({ dbName })
    const migrated = await adapter.getSession('legacy-session')
    expect(migrated).toMatchObject({ id: 'legacy-session', updatedAt: timestamp })
    expect(await adapter.getSessionState('legacy-active')).toMatchObject({ phase: 'warmup', activeExerciseIndex: 0 })
    expect((await adapter.getAppMeta())?.databaseVersion).toBe(3)
    await cleanup(adapter)
  })

  it('persists workout lifecycle, resumes, queries history, and cascades reset', async () => {
    const dbName = uniqueDbName()
    const adapter = makeAdapter(dbName)
    const session = await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const log = await adapter.createExerciseLog({ sessionId: session.id, exerciseId: 'squat', planSlotId: 'A-1', order: 0, targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' } })
    await adapter.createSetLog({ exerciseLogId: log.id, setNumber: 1, reps: 10, bandKeys: [], effort: 'just-right', completedAt: timestamp })
    await adapter.createSetLog({ exerciseLogId: log.id, setNumber: 2, reps: 10, bandKeys: [], effort: 'just-right', completedAt: timestamp })
    await adapter.updateSession({ ...session, status: 'completed', completedAt: timestamp, updatedAt: timestamp })
    await adapter.close()
    const resumed = new IndexedDbStorageAdapter({ dbName, now: () => timestamp, idFactory: () => 'unused' })
    expect((await resumed.getExerciseLogs(session.id))).toHaveLength(1)
    expect((await resumed.getSetLogs(log.id))).toHaveLength(2)
    expect((await resumed.listRecentPerformance('squat'))[0].sets).toHaveLength(2)
    expect((await resumed.listSessions({ status: 'completed' }))).toHaveLength(1)
    await resumed.resetAllData()
    expect(await resumed.exportData()).toMatchObject({ bands: [], sessions: [], exerciseLogs: [], setLogs: [] })
    await cleanup(resumed)
  })

  it('atomically cascades a session deletion to its exercise and set logs only', async () => {
    const adapter = makeAdapter()
    const removed = await adapter.createSession({ id: 'removed-session', workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const retained = await adapter.createSession({ id: 'retained-session', workoutKey: 'B', planVersion: '1', scheduledDate: '2026-08-17' })
    const removedLog = await adapter.createExerciseLog({ sessionId: removed.id, exerciseId: 'squat', planSlotId: 'A-1', order: 0, targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' } })
    const retainedLog = await adapter.createExerciseLog({ sessionId: retained.id, exerciseId: 'row', planSlotId: 'B-1', order: 0, targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' } })
    await adapter.createSetLog({ exerciseLogId: removedLog.id, setNumber: 1, reps: 10, bandKeys: [], effort: 'just-right', completedAt: timestamp })
    await adapter.createSetLog({ exerciseLogId: retainedLog.id, setNumber: 1, reps: 9, bandKeys: [], effort: 'just-right', completedAt: timestamp })
    await adapter.deleteSession(removed.id)
    expect(await adapter.getSession(removed.id)).toBeUndefined()
    expect(await adapter.getExerciseLogs(removed.id)).toEqual([])
    expect(await adapter.getSetLogs(removedLog.id)).toEqual([])
    expect(await adapter.getSession(retained.id)).toBeDefined()
    expect(await adapter.getSetLogs(retainedLog.id)).toHaveLength(1)
    await cleanup(adapter)
  })

  it('round trips backup data and automatically restores a replacement after injected failure', async () => {
    const dbName = uniqueDbName()
    const source = makeAdapter(dbName)
    await source.saveProfile(profile)
    const session = await source.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const exported = await source.exportData()
    await source.close()
    const failing = makeAdapter(dbName, (stage) => { if (stage === 'after-clear') throw new Error('injected replacement failure') })
    await expect(failing.importData('replace', { ...exported, sessions: [] })).rejects.toThrow(/injected replacement failure/)
    expect((await failing.getProfile())?.id).toBe('profile')
    expect((await failing.listSessions())).toHaveLength(1)
    await failing.close()
    await cleanup(failing)
    void session
  })

  it('replaces local records exactly after validation', async () => {
    const adapter = makeAdapter()
    await adapter.saveProfile(profile)
    await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const incoming = await adapter.exportData()
    incoming.sessions = []
    const report = await adapter.importData('replace', incoming)
    expect(report.sessions).toBe(0)
    expect(await adapter.exportData()).toEqual(incoming)
    await cleanup(adapter)
  })

  it('persists the exact active phase, exercise index, draft, and timer for refresh resume', async () => {
    const adapter = makeAdapter()
    const session = await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const state: WorkoutSessionState = {
      phase: 'working', activeExerciseIndex: 3,
      draft: { reps: '11', durationSeconds: undefined, bandKeys: ['serious-steel-1', 'serious-steel-2'], setupAdjustment: 'other', setupNote: 'ankle anchor', effort: 'easy' },
      restTimerSeconds: 37, restTimerRunning: true,
    }
    await adapter.saveSessionState(session.id, state)
    expect(await adapter.getSessionState(session.id)).toEqual(state)
    expect((await adapter.getSession(session.id))?.activeState).toEqual(state)
    await cleanup(adapter)
  })

  it('never resurrects a completed or skipped session', async () => {
    const adapter = makeAdapter()
    const session = await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    await adapter.updateSession({ ...session, status: 'completed', completedAt: timestamp, updatedAt: timestamp })
    await expect(adapter.saveSessionState(session.id, {
      phase: 'working', activeExerciseIndex: 1,
      draft: { bandKeys: [], setupAdjustment: 'standard', effort: 'just-right' }, restTimerSeconds: 0, restTimerRunning: false,
    })).rejects.toThrow(/finalized|resumed/i)
    await expect(adapter.updateSession({ ...session, status: 'in-progress', updatedAt: timestamp })).rejects.toThrow(/finalized|resumed/i)
    await cleanup(adapter)
  })

  it('makes repeated writes for one set number idempotent', async () => {
    const adapter = makeAdapter()
    const session = await adapter.createSession({ workoutKey: 'A', planVersion: '1', scheduledDate: '2026-08-16' })
    const log = await adapter.createExerciseLog({ sessionId: session.id, exerciseId: 'squat', planSlotId: 'A-1', order: 0, targetSnapshot: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' } })
    const first = await adapter.createSetLog({ id: 'set-1', exerciseLogId: log.id, setNumber: 1, reps: 10, bandKeys: [], effort: 'just-right', completedAt: timestamp })
    const repeated = await adapter.createSetLog({ id: 'set-2', exerciseLogId: log.id, setNumber: 1, reps: 12, bandKeys: [], effort: 'easy', completedAt: timestamp })
    expect(repeated.id).toBe(first.id)
    expect(await adapter.getSetLogs(log.id)).toHaveLength(1)
    await cleanup(adapter)
  })
})
