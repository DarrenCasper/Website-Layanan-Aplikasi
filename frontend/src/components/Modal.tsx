import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import closeIcon from '../assets/icons/x-modal.svg'
import './Modal.scss'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  /** "sm" is the 440px confirmation; "md" the 560px listing form. */
  size?: 'sm' | 'md'
  /** Blocks closing while a save is in flight. */
  busy?: boolean
}

// Dialog from the dashboard frames (Figma 97:8607, 97:9066): white, 14px
// radius, 24/28px padding, over a dimmed page. Escape and the scrim close it,
// Tab stays inside it, and focus returns to whatever opened it.
function Modal({ title, onClose, children, size = 'md', busy = false }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const first = dialogRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    ;(first ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="modal-layer" onKeyDown={handleKeyDown}>
      <div className="modal-scrim" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="modal__head">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button
            className="modal__close"
            type="button"
            aria-label="Tutup"
            disabled={busy}
            onClick={onClose}
          >
            <img src={closeIcon} alt="" width={22} height={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
