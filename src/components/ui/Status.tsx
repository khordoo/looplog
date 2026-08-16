import { forwardRef, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

let lastActivatedButton: HTMLButtonElement | null = null

export function Status({ children, kind = 'info', testId }: { children: ReactNode; kind?: 'info' | 'success' | 'warning' | 'error'; testId?: string }) {
  return <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={testId}><span className="status-mark" aria-hidden="true">{kind === 'error' ? '!' : kind === 'warning' ? '!' : kind === 'success' ? '✓' : 'i'}</span><span>{children}</span></div>
}

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>(function Button({ children, variant = 'primary', onClick, ...props }, ref) {
  return <button ref={ref} className={`button button-${variant}`} onClick={(event) => { lastActivatedButton = event.currentTarget; onClick?.(event) }} {...props}>{children}</button>
})

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

interface DialogProps {
  title: string
  children: ReactNode
  onClose: () => void
  actions?: ReactNode
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function Dialog({ title, children, onClose, actions, returnFocusRef }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    returnFocus.current = returnFocusRef?.current ?? active ?? lastActivatedButton
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal()
    else dialog.setAttribute('open', '')
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((item) => !item.hasAttribute('disabled'))
    const first = focusable()[0]
    ;(first ?? dialog).focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); return }
      const current = document.activeElement
      const index = items.indexOf(current as HTMLElement)
      if (event.shiftKey && (index <= 0 || current === dialog)) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0].focus() }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      const target = returnFocus.current
      if (target) {
        target.focus()
        window.setTimeout(() => { if (document.activeElement === document.body) target.focus() }, 0)
      }
    }
  }, [onClose, returnFocusRef])

  return <dialog ref={dialogRef} className="dialog" aria-modal="true" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <h2 id={titleId} tabIndex={-1}>{title}</h2>
    <div>{children}</div>
    <div className="dialog-actions">{actions}</div>
  </dialog>
}
