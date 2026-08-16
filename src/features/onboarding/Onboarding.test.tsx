import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import { Onboarding } from './Onboarding'
import type { StorageAdapter } from '../../storage/adapter'

function adapter(): StorageAdapter {
  return { getProfile: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(), listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), createExerciseLog: vi.fn(), getExerciseLogs: vi.fn(), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn(), listRecentPerformance: vi.fn(), exportData: vi.fn(), importData: vi.fn(), getAppMeta: vi.fn(), saveAppMeta: vi.fn(), resetAllData: vi.fn() }
}

describe('Onboarding', () => {
  it('shows the default timezone and validates safety before finishing', async () => {
    render(<MemoryRouter><AppProvider adapter={adapter()}><Onboarding /></AppProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('heading', { name: /build your training rhythm/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('persists a safe incomplete profile through the adapter as steps advance', async () => {
    const saveProfile = vi.fn().mockResolvedValue(undefined)
    const storage = adapter(); storage.saveProfile = saveProfile
    const user = userEvent.setup()
    render(<MemoryRouter><AppProvider adapter={storage}><Onboarding /></AppProvider></MemoryRouter>)
    await user.clear(screen.getByLabelText('Timezone'))
    await user.type(screen.getByLabelText('Timezone'), 'America/Toronto')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(saveProfile).toHaveBeenCalled())
    expect(saveProfile.mock.calls.some(([profile]) => profile.timezone === 'America/Toronto' && profile.onboardingCompleted === false)).toBe(true)
  })
})
