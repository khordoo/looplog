import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import type { CustomExercise } from '../../domain/types'
import type { StorageAdapter } from '../../storage/adapter'
import { CustomExerciseForm } from './CustomExerciseForm'

const stamp = '2026-08-17T12:00:00.000Z'
const saved: CustomExercise = { id: '11111111-1111-4111-8111-111111111111', createdAt: stamp, updatedAt: stamp, name: 'Desk reach', category: 'mobility', targetKind: 'duration', targetRange: { min: 20, max: 30 }, sets: 2, setup: [], steps: [], formCues: [], archived: false }

function adapter(): StorageAdapter {
  return { getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(), listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), createExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue([]), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue([]), listRecentPerformance: vi.fn().mockResolvedValue([]), exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn(), saveCustomExercise: vi.fn().mockResolvedValue(saved) }
}

describe('CustomExerciseForm', () => {
  it('validates required fields and saves a local custom exercise', async () => {
    const user = userEvent.setup(); const store = adapter()
    render(<MemoryRouter initialEntries={['/exercises/custom/new']}><AppProvider adapter={store}><Routes><Route path="/exercises/custom/new" element={<CustomExerciseForm />} /><Route path="/exercises/:id" element={<div>saved</div>} /></Routes></AppProvider></MemoryRouter>)
    await user.type(screen.getByLabelText('Name'), 'Desk reach')
    await user.click(screen.getByRole('button', { name: /create exercise/i }))
    expect(store.saveCustomExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Desk reach', category: 'core', targetKind: 'reps', targetRange: { min: 8, max: 12 }, sets: 2 }))
  })
})
