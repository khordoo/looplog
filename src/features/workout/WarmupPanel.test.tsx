import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WarmupPanel } from './WarmupPanel'

describe('WarmupPanel', () => {
  it('presents four scannable one-minute moves and starts the working sets', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WarmupPanel workoutKey="B" onComplete={onComplete} />)
    expect(screen.getByRole('heading', { name: /prepare to move/i })).toBeVisible()
    expect(screen.getByLabelText(/four-minute warm-up/i).querySelectorAll('article')).toHaveLength(4)
    expect(screen.getAllByText('60s')).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: /start working sets/i }))
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
