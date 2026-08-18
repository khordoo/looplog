import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '../../app/providers/AppProvider'
import { BandsSettings, BackupSettings, Settings, SubstitutionSettings } from './Settings'
import { AppearanceSettings } from './AppearanceSettings'
import type { Profile } from '../../domain/types'
import type { StorageAdapter } from '../../storage/adapter'

const profile: Profile = { id: 'profile', timezone: 'America/Toronto', daysPerWeek: 3, mode: 'flexible', fixedWeekdays: [], planVersion: 'v1', onboardingCompleted: true, safetyAcknowledged: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }

function adapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return { getProfile: vi.fn().mockResolvedValue(profile), saveProfile: vi.fn(), getBands: vi.fn().mockResolvedValue([]), replaceBands: vi.fn(), listSubstitutions: vi.fn().mockResolvedValue([]), saveSubstitution: vi.fn(), removeSubstitution: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), createExerciseLog: vi.fn(), getExerciseLogs: vi.fn().mockResolvedValue([]), createSetLog: vi.fn(), updateSetLog: vi.fn(), getSetLogs: vi.fn().mockResolvedValue([]), listRecentPerformance: vi.fn().mockResolvedValue([]), exportData: vi.fn().mockResolvedValue({ profile, bands: [], substitutions: [], sessions: [], exerciseLogs: [], setLogs: [] }), importData: vi.fn(), getAppMeta: vi.fn().mockResolvedValue(undefined), saveAppMeta: vi.fn(), resetAllData: vi.fn(), ...overrides }
}

function renderPage(element: React.ReactNode, storage: StorageAdapter) {
  return render(<MemoryRouter><AppProvider adapter={storage}>{element}</AppProvider></MemoryRouter>)
}

describe('Settings component flows', () => {
  afterEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('offers an accessible appearance choice that persists across a remount', async () => {
    const user = userEvent.setup(); const storage = adapter(); renderPage(<AppearanceSettings />, storage)
    const system = await screen.findByRole('radio', { name: /system/i })
    expect(system).toBeChecked()
    system.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: /light/i })).toBeChecked()
    await user.click(screen.getByTestId('appearance-dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('looplog-appearance')).toBe('dark')
    cleanup(); renderPage(<AppearanceSettings />, storage)
    expect(await screen.findByRole('radio', { name: /dark/i })).toBeChecked()
    expect(screen.getByTestId('appearance-status')).toHaveTextContent(/dark colors/i)
  })

  it('updates System appearance from a live operating-system preference event', async () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = []
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener), removeEventListener: vi.fn() })) })
    const storage = adapter(); const rendered = renderPage(<AppearanceSettings />, storage)
    expect(await screen.findByTestId('appearance-status')).toHaveTextContent(/light colors/i)
    rendered.rerender(<MemoryRouter><AppProvider adapter={storage}><div /></AppProvider></MemoryRouter>)
    await act(async () => { listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)) })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('covers band availability selection and save', async () => {
    const user = userEvent.setup(); const storage = adapter(); renderPage(<BandsSettings />, storage)
    const available = await screen.findAllByRole('checkbox', { name: /available/i })
    await user.click(available[0]); await user.click(screen.getByRole('button', { name: /save bands/i }))
    await waitFor(() => expect(storage.replaceBands).toHaveBeenCalled())
    expect(screen.getByText(/band inventory saved/i)).toBeInTheDocument()
  })

  it('saves a compatible same-target substitution and restores the default', async () => {
    const user = userEvent.setup(); const storage = adapter(); renderPage(<SubstitutionSettings />, storage)
    const select = (await screen.findAllByTestId('substitution-select'))[0]
    const candidate = (select as HTMLSelectElement).options[1].value
    await user.selectOptions(select, candidate)
    await waitFor(() => expect(storage.saveSubstitution).toHaveBeenCalled())
    const restore = await screen.findByTestId('restore-substitution'); await user.click(restore)
    await waitFor(() => expect(storage.removeSubstitution).toHaveBeenCalledWith('A-1'))
  })

  it('shows backup reminder and rejects an invalid backup preview before import', async () => {
    const user = userEvent.setup(); const oldMeta = { id: 'app' as const, databaseVersion: 3, dismissedNotices: [], lastSuccessfulExportAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }
    const sessions = Array.from({ length: 5 }, (_, index) => ({ id: `session-${index}`, workoutKey: 'A' as const, planVersion: 'v1', scheduledDate: `2026-01-${String(index + 1).padStart(2, '0')}` as `${number}-${number}-${number}`, status: 'completed' as const, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:00.000Z' }))
    const storage = adapter({ getAppMeta: vi.fn().mockResolvedValue(oldMeta), listSessions: vi.fn().mockResolvedValue(sessions) }); renderPage(<Settings />, storage)
    expect(await screen.findByTestId('backup-reminder')).toBeInTheDocument()
    cleanup(); renderPage(<BackupSettings />, storage)
    const file = new File(['{"schemaVersion":1}'], 'malformed.json', { type: 'application/json' })
    await user.upload(await screen.findByTestId('backup-file-input'), file)
    expect(await screen.findByTestId('backup-error')).toHaveTextContent(/backup|validation|malformed/i)
    expect(storage.importData).not.toHaveBeenCalled()
  })
})
