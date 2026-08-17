import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import type { Band, PerformanceRecord, WorkoutSession } from '../../domain/types'
import type { StorageAdapter } from '../../storage/adapter'
import { SessionDetail, SessionSummary } from './SessionSummary'

const stamp = '2026-08-16T12:00:00.000Z'
const band: Band = { id: 'purple-1', createdAt: stamp, updatedAt: stamp, key: 'purple-1', brand: 'Test', lengthInches: 41, number: 1, displayColor: 'Purple', nominalMinLb: 3, nominalMaxLb: 8, enabled: true }

function adapter(performance: PerformanceRecord[] = []): StorageAdapter {
  return {
    getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([band]), replaceBands: vi.fn(),
    listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]),
    createExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue([]), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue([]), listRecentPerformance: vi.fn().mockImplementation(async (exerciseId: string) => performance.filter((item) => item.exerciseId === exerciseId)),
    exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn(),
  }
}

describe('SessionSummary', () => {
  it('shows every movement, planned rest, and First time when no history exists', async () => {
    render(<MemoryRouter><AppProvider adapter={adapter()}><SessionSummary workoutKey="A" /></AppProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId(/session-summary-row-/)).toHaveLength(6))
    expect(screen.getAllByText('First time')).toHaveLength(6)
    expect(screen.getAllByText('1:00')).toHaveLength(6)
  })

  it('keeps mixed set performance readable with a named, color-coded band', async () => {
    const previous: PerformanceRecord = { exerciseId: 'lower-front-squat-band', completedAt: stamp, target: { sets: 2, repRange: { min: 8, max: 12 }, bandKeys: [], source: 'default' }, sets: [{ reps: 10, effort: 'just-right', bandKeys: ['purple-1'] }, { reps: 8, effort: 'max-effort', bandKeys: [] }] }
    render(<MemoryRouter><AppProvider adapter={adapter([previous])}><SessionSummary workoutKey="A" /></AppProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('session-summary-row-A-1')).toHaveTextContent('10 reps'))
    expect(screen.getByTestId('session-summary-row-A-1')).toHaveTextContent('Max effort')
    expect(screen.getByLabelText('Band Purple #1')).toBeInTheDocument()
    expect(screen.getByTestId('session-summary-row-A-1')).toHaveTextContent('Bodyweight')
  })

  it('includes the read-only warm-up, working movements, and cooldown sections', async () => {
    render(<MemoryRouter><AppProvider adapter={adapter()}><SessionDetail workoutKey="C" /></AppProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Warm-up' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Working movements' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cooldown' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId(/session-summary-row-/)).toHaveLength(7))
  })

  it('keeps a resumed log visible when its slot was removed from the current plan', async () => {
    const session: WorkoutSession = { id: 'session-1', workoutKey: 'A', planVersion: 'v1', scheduledDate: '2026-08-16', status: 'in-progress', createdAt: stamp, updatedAt: stamp }
    const store = adapter()
    vi.mocked(store.getExerciseLogs).mockResolvedValue([{ id: 'log-1', sessionId: session.id, exerciseId: 'removed-custom-id', planSlotId: 'removed-slot', order: 0, exerciseNameSnapshot: 'Removed movement snapshot', targetSnapshot: { sets: 3, repRange: { min: 5, max: 7 }, bandKeys: [], restSeconds: 75, source: 'default' }, createdAt: stamp, updatedAt: stamp }])
    render(<MemoryRouter><AppProvider adapter={store}><SessionSummary workoutKey="A" session={session} /></AppProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('session-summary-row-removed-slot')).toBeInTheDocument())
    expect(screen.getByTestId('session-summary-row-removed-slot')).toHaveTextContent('Removed movement snapshot')
    expect(screen.getByTestId('session-summary-row-removed-slot')).toHaveTextContent('3 × 5–7')
    expect(screen.getByTestId('session-summary-row-removed-slot')).toHaveTextContent('1:15')
  })
})
