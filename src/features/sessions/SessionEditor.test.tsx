import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import { slotsFor, exercises } from '../../lib/content'
import type { PlanConfiguration } from '../../domain/types'
import type { StorageAdapter } from '../../storage/adapter'
import { SessionDetail } from './SessionSummary'

const stamp = '2026-08-17T12:00:00.000Z'
const configuration: PlanConfiguration = { id: 'A', workoutKey: 'A', revision: 1, sourceVersion: 'v1', slots: slotsFor('A').map((slot) => ({ ...slot, restSeconds: 60 })), warmupMinutes: 4, cooldownMinutes: 2, createdAt: stamp, updatedAt: stamp }
function adapter() { const savePlanConfiguration = vi.fn().mockResolvedValue(undefined); const store: StorageAdapter = { getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(), listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), materializePlanConfiguration: vi.fn().mockResolvedValue(configuration), resolvePlan: vi.fn().mockResolvedValue({ workoutKey: 'A', version: 'v1', slots: configuration.slots, warmupMinutes: 4, cooldownMinutes: 2 }), listExercises: vi.fn().mockResolvedValue(exercises), savePlanConfiguration, createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), createExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue([]), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue([]), listRecentPerformance: vi.fn().mockResolvedValue([]), exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn() }; return { store, savePlanConfiguration } }

describe('SessionEditor', () => {
  it('keeps Cancel atomic and exposes accessible reorder/remove controls', async () => {
    const user = userEvent.setup(); const { store, savePlanConfiguration } = adapter()
    render(<MemoryRouter><AppProvider adapter={store}><SessionDetail workoutKey="A" /></AppProvider></MemoryRouter>)
    await user.click(await screen.findByTestId('edit-session'))
    expect(await screen.findByTestId('session-editor')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /move .* up/i }).length).toBe(6)
    await user.click(screen.getAllByRole('button', { name: /remove from session/i })[0])
    expect(await screen.findByRole('dialog')).toHaveTextContent(/remove movement/i)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^cancel$/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(savePlanConfiguration).not.toHaveBeenCalled()
  })
})
