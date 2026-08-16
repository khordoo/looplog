import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import { slotsFor, exerciseById } from '../../lib/content'
import type { StorageAdapter } from '../../storage/adapter'
import type { ExerciseLog, PerformanceRecord, SetLog, WorkoutSession } from '../../domain/types'
import { targetForSnapshot, Workout } from './Workout'

// Keep this adapter deliberately small but complete enough to prove that the
// component consumes adapter-neutral state and refuses finalized sessions.
function makeAdapter(session: WorkoutSession, logs: ExerciseLog[] = [], recent: PerformanceRecord[] = []): StorageAdapter {
  const emptySets: SetLog[] = []
  return {
    getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(),
    getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(),
    listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(),
    createSession: vi.fn(), getSession: vi.fn().mockResolvedValue(session), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]),
    createExerciseLog: vi.fn(), updateExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue(logs),
    createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue(emptySets), listRecentPerformance: vi.fn().mockResolvedValue(recent),
    exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn(),
    getSessionState: vi.fn().mockResolvedValue(session.activeState), saveSessionState: vi.fn(),
  }
}

function renderWorkout(adapter: StorageAdapter) {
  return render(<AppProvider adapter={adapter}><MemoryRouter initialEntries={[`/workout/${'session-1'}`]}><Routes><Route path="/workout/:sessionId" element={<Workout />} /></Routes></MemoryRouter></AppProvider>)
}

const stamp = '2026-08-16T12:00:00.000Z'
const activeState = {
  phase: 'working' as const,
  activeExerciseIndex: 1,
  draft: { reps: '11', bandKeys: [], setupAdjustment: 'shortened-grip' as const, effort: 'easy' as const },
  restTimerSeconds: 37,
  restTimerRunning: false,
}
const activeSession: WorkoutSession = { id: 'session-1', createdAt: stamp, updatedAt: stamp, workoutKey: 'A', planVersion: 'v1', scheduledDate: '2026-08-16', status: 'in-progress', startedAt: stamp, activeState }

function logsFor(session: WorkoutSession): ExerciseLog[] {
  return slotsFor(session.workoutKey).map((slot) => ({
    id: `log-${slot.id}`, createdAt: stamp, updatedAt: stamp, sessionId: session.id,
    exerciseId: slot.exerciseId, planSlotId: slot.id, order: slot.order,
    targetSnapshot: { sets: slot.defaultSets, repRange: slot.repRange, durationSeconds: slot.durationSeconds, bandKeys: [], source: 'default' },
  }))
}

describe('Workout resume boundary', () => {
  it('uses the selected exercise default when a substitution changes reps to duration', () => {
    const repSlot = slotsFor('A')[0]
    const target = targetForSnapshot(repSlot, 'core-side-plank')
    expect(target.repRange).toBeUndefined()
    expect(target.durationSeconds).toEqual({ min: 15, max: 30 })
    expect(target.sets).toBe(repSlot.defaultSets)
  })

  it('hydrates persisted phase/index/draft instead of resetting to warmup or exercise one', async () => {
    const adapter = makeAdapter(activeSession, logsFor(activeSession))
    renderWorkout(adapter)
    expect(await screen.findByTestId('active-exercise')).toHaveTextContent(exerciseById('upper-row-seated-feet')?.name ?? '')
    expect(screen.getByRole('img', { name: /seated band row around feet setup illustration/i })).toHaveAttribute('src', '/exercises/upper-row-seated-feet.webp')
    expect(screen.getByRole('button', { name: /load seated band row around feet demonstration video/i })).toBeVisible()
    expect(screen.getByTestId('set-reps')).toHaveValue(11)
    expect(screen.getByTestId('setup-adjustment')).toHaveValue('shortened-grip')
    expect(screen.getByTestId('effort-select')).toHaveValue('easy')
    await waitFor(() => expect(adapter.saveSessionState).toHaveBeenCalled())
    expect(adapter.saveSessionState).toHaveBeenCalledWith('session-1', expect.objectContaining({ phase: 'working', activeExerciseIndex: 1, draft: expect.objectContaining({ reps: '11', setupAdjustment: 'shortened-grip', effort: 'easy' }) }))
  })

  it('shows the previous completed result before the set controls', async () => {
    const previous: PerformanceRecord = {
      exerciseId: 'upper-row-seated-feet', sessionId: 'older-session', exerciseLogId: 'older-log', completedAt: stamp,
      target: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: ['serious-steel-2'], source: 'default' },
      sets: [{ reps: 10, effort: 'just-right', bandKeys: ['serious-steel-2'] }, { reps: 11, effort: 'just-right', bandKeys: ['serious-steel-2'] }],
    }
    const adapter = makeAdapter(activeSession, logsFor(activeSession), [previous])
    renderWorkout(adapter)
    await waitFor(() => expect(screen.getByTestId('previous-result')).toHaveTextContent(/10 · 11 · serious-steel-2/i))
    const targetPosition = screen.getByTestId('previous-result').compareDocumentPosition(screen.getByTestId('set-complete'))
    expect(targetPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('refuses to resurrect a completed session at the UI boundary', async () => {
    const completed: WorkoutSession = { ...activeSession, status: 'completed', completedAt: stamp, activeState: undefined }
    const adapter = makeAdapter(completed)
    renderWorkout(adapter)
    expect(await screen.findByRole('alert')).toHaveTextContent(/already finalized/i)
    expect(adapter.updateSession).not.toHaveBeenCalled()
    expect(adapter.saveSessionState).not.toHaveBeenCalled()
  })
})
