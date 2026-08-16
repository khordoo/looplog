import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Button, Dialog, Status } from './Status'

describe('Status', () => {
  it('uses an alert role for errors and a status role otherwise', () => {
    render(<><Status kind="error">Something went wrong</Status><Status>Saved locally</Status></>)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('status')).toHaveTextContent('Saved locally')
  })

  it('traps dialog focus and returns focus to the trigger', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><Button onClick={() => setOpen(true)}>Open dialog</Button>{open && <Dialog title="Confirm" onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>Close</Button>}><p>Content</p></Dialog>}</>
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus(); fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument()
    screen.getByRole('button', { name: 'Close' }).focus(); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(trigger).toHaveFocus()
  })
})
