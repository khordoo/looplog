import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DeskReset } from './DeskReset'

describe('DeskReset', () => {
  it('provides five timed movements without implying workout progression', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeskReset /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /five-minute desk reset/i })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5 + 3)
    expect(screen.getByText(/never changes your workout rotation, history, or progression/i)).toBeInTheDocument()
    expect(screen.getByTestId('desk-reset-timer')).toHaveTextContent('5:00')
    await user.click(screen.getByRole('button', { name: /next movement/i }))
    expect(screen.getByTestId('desk-reset-timer')).toHaveTextContent('4:00')
    expect(screen.getByRole('heading', { name: /thoracic rotation/i })).toBeInTheDocument()
  })
})
