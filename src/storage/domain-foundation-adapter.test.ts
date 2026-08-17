import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDbStorageAdapter } from './indexeddb-adapter'
import type { CustomExercise, PlanConfiguration } from '../domain/types'

const timestamp = '2026-08-17T12:00:00.000Z'
const customId = '11111111-1111-4111-8111-111111111111'
let sequence = 0
function dbName(): string { sequence += 1; return `training-tracker-domain-${sequence}-${Date.now()}` }
function customExercise(): CustomExercise {
  return {
    id: customId, createdAt: timestamp, updatedAt: timestamp, name: 'Local press', category: 'push-horizontal',
    targetKind: 'reps', targetRange: { min: 6, max: 10 }, sets: 3, setup: ['Use a clear floor'], steps: ['Press smoothly'], formCues: ['Ribs stacked'], photoDataUrl: 'data:image/webp;base64,UklGRg==', archived: false,
  }
}

describe('editable plan and custom exercise adapter contracts', () => {
  it('materializes legacy substitutions once, then atomically snapshots a configured session', async () => {
    const adapter = new IndexedDbStorageAdapter({ dbName: dbName(), now: () => timestamp, idFactory: (() => { let id = 0; return () => `record-${++id}` })() })
    await adapter.saveSubstitution({ id: 'sub-1', createdAt: timestamp, updatedAt: timestamp, planSlotId: 'A-1', originalExerciseId: 'lower-front-squat-band', selectedExerciseId: 'lower-reverse-lunge' })
    const configuration = await adapter.materializePlanConfiguration('A')
    expect(configuration.slots[0].exerciseId).toBe('lower-reverse-lunge')
    expect(await adapter.listSubstitutions()).toEqual([])
    const session = await adapter.startSession({ workoutKey: 'A', planVersion: 'v1', scheduledDate: '2026-08-18' })
    const logs = await adapter.getExerciseLogs(session.id)
    expect(logs).toHaveLength(6)
    expect(logs.map((log) => log.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(logs[0].targetSnapshot.restSeconds).toBe(60)
    expect(session.planVersion).toBe('v1:A:1')
    const originalSnapshot = logs.map((log) => ({ id: log.id, slot: log.planSlotId, exercise: log.exerciseId }))
    await adapter.savePlanConfiguration({ ...configuration, revision: 2, updatedAt: timestamp, slots: configuration.slots.slice().reverse().map((slot, order) => ({ ...slot, order })) })
    const duplicate = await adapter.startSession({ workoutKey: 'A', planVersion: 'ignored', scheduledDate: '2026-08-18' })
    expect(duplicate.id).toBe(session.id)
    expect((await adapter.getExerciseLogs(session.id)).map((log) => ({ id: log.id, slot: log.planSlotId, exercise: log.exerciseId }))).toEqual(originalSnapshot)
    await adapter.deleteDatabase()
  })

  it('merges custom content into the repository and archives instead of deleting referenced records', async () => {
    const adapter = new IndexedDbStorageAdapter({ dbName: dbName(), now: () => timestamp, idFactory: (() => { let id = 0; return () => `record-${++id}` })() })
    await adapter.saveCustomExercise(customExercise())
    expect((await adapter.listExercises()).some((exercise) => exercise.id === customId)).toBe(true)
    const config = await adapter.materializePlanConfiguration('B')
    const changed: PlanConfiguration = { ...config, revision: 2, updatedAt: timestamp, slots: config.slots.map((slot, index) => index === 0 ? { ...slot, exerciseId: customId, category: 'push-horizontal', repRange: { min: 6, max: 10 }, durationSeconds: undefined } : slot) }
    await adapter.savePlanConfiguration(changed)
    const session = await adapter.startSession({ workoutKey: 'B', planVersion: 'v1', scheduledDate: '2026-08-18' })
    const log = (await adapter.getExerciseLogs(session.id))[0]
    expect(log.exerciseId).toBe(customId)
    expect(log.exerciseNameSnapshot).toBe('Local press')
    await adapter.deleteCustomExercise(customId)
    expect(await adapter.getCustomExercise(customId)).toBeUndefined()
    expect(await adapter.getCustomExercise(customId, { includeArchived: true })).toMatchObject({ archived: true })
    await adapter.deleteDatabase()
  })

  it('exports and replaces editable plans/custom records together with history', async () => {
    const source = new IndexedDbStorageAdapter({ dbName: dbName(), now: () => timestamp, idFactory: (() => { let id = 0; return () => `source-${++id}` })() })
    await source.saveCustomExercise(customExercise())
    const configuration = await source.materializePlanConfiguration('C')
    await source.savePlanConfiguration({ ...configuration, revision: 2, updatedAt: timestamp, slots: configuration.slots.map((slot, index) => index === 0 ? { ...slot, exerciseId: customId, category: 'push-horizontal', repRange: { min: 6, max: 10 }, durationSeconds: undefined } : slot) })
    const session = await source.startSession({ workoutKey: 'C', planVersion: 'v1', scheduledDate: '2026-08-18' })
    const exported = await source.exportData()
    const target = new IndexedDbStorageAdapter({ dbName: dbName(), now: () => timestamp, idFactory: (() => { let id = 0; return () => `target-${++id}` })() })
    await target.importData('replace', exported)
    expect((await target.getCustomExercise(customId))?.name).toBe('Local press')
    expect((await target.getCustomExercise(customId))?.photoDataUrl).toBe('data:image/webp;base64,UklGRg==')
    expect((await target.getPlanConfiguration('C'))?.revision).toBe(2)
    expect((await target.getExerciseLogs(session.id))[0].exerciseNameSnapshot).toBe('Local press')
    await source.deleteDatabase(); await target.deleteDatabase()
  })
})
