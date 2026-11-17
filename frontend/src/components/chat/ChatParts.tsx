import { useChat } from '../../context/chatContext'
import { initialsOf } from '../../lib/merchants'
import backIcon from '../../assets/icons/back-dark.svg'
import closeIcon from '../../assets/icons/x-dark.svg'
import emptyIcon from '../../assets/icons/chat-muted.svg'
import alertIcon from '../../assets/icons/alert-large.svg'
import retryIcon from '../../assets/icons/retry.svg'

type ChatHeaderProps = {
  title: string
  subtitle?: string
  /** Present in a conversation: shows the back arrow and the avatar. */
  onBack?: () => void
}

// Popup header (Figma 97:10050 inbox, 97:10135 conversation).
export function ChatHeader({ title, subtitle, onBack }: ChatHeaderProps) {
  const { close } = useChat()

  return (
    <div className={onBack ? 'chat-head chat-head--thread' : 'chat-head'}>
      {onBack ? (
        <>
          <button
            className="chat-icon-button"
            type="button"
            aria-label="Kembali ke daftar chat"
            onClick={onBack}
          >
            <img src={backIcon} alt="" width={20} height={20} />
          </button>
          <span className="chat-avatar chat-avatar--dark chat-avatar--sm" aria-hidden="true">
            {initialsOf(title)}
          </span>
        </>
      ) : null}

      <div className="chat-head__text">
        <h2 className="chat-head__title">{title}</h2>
        {subtitle ? <p className="chat-head__subtitle">{subtitle}</p> : null}
      </div>

      <button className="chat-icon-button" type="button" aria-label="Tutup chat" onClick={close}>
        <img src={closeIcon} alt="" width={20} height={20} />
      </button>
    </div>
  )
}

type ChatStateProps = {
  kind: 'empty' | 'error' | 'loading'
  title: string
  text?: string
  onRetry?: () => void
}

// Empty and error states (Figma 97:10230, 97:10282), plus a quiet loading line.
export function ChatState({ kind, title, text, onRetry }: ChatStateProps) {
  if (kind === 'loading') {
    return (
      <div className="chat-state" role="status">
        <p className="chat-state__loading">{title}</p>
      </div>
    )
  }

  return (
    <div className="chat-state" role={kind === 'error' ? 'alert' : 'status'}>
      <span
        className={
          kind === 'error' ? 'chat-state__icon chat-state__icon--danger' : 'chat-state__icon'
        }
        aria-hidden="true"
      >
        <img src={kind === 'error' ? alertIcon : emptyIcon} alt="" width={28} height={28} />
      </span>
      <p className="chat-state__title">{title}</p>
      {text ? <p className="chat-state__text">{text}</p> : null}
      {onRetry ? (
        <button className="chat-state__retry" type="button" onClick={onRetry}>
          <img src={retryIcon} alt="" width={16} height={16} />
          Coba lagi
        </button>
      ) : null}
    </div>
  )
}
