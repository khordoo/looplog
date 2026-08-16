import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import { ExerciseDetail } from './Exercises'
import type { StorageAdapter } from '../../storage/adapter'

function adapter(): StorageAdapter {
  return { getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(), listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), createExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue([]), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue([]), listRecentPerformance: vi.fn().mockResolvedValue([]), exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn() }
}

describe('ExerciseDetail', () => {
  it('shows offline written guidance and only loads the no-cookie video after a click', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/exercises/lower-front-squat-band']}><AppProvider adapter={adapter()}><Routes><Route path="/exercises/:exerciseId" element={<ExerciseDetail />} /></Routes></AppProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('exercise-guide')).toBeInTheDocument())
    expect(screen.getByText(/breathing and tempo/i)).toBeInTheDocument()
    expect(screen.queryByTitle(/demonstration/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /load .* demonstration video/i }))
    expect(screen.getByTitle(/demonstration/i)).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed'))
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    await waitFor(() => expect(screen.getByText(/written guide remains available/i)).toBeInTheDocument())
  })
})
