import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useAuth } from '../../context/authContext'
import { useChat } from '../../context/chatContext'
import ChatInbox from './ChatInbox'
import ChatConversation from './ChatConversation'
import { ChatHeader, ChatState } from './ChatParts'
import chatIcon from '../../assets/icons/chat-dark.svg'
import closeIcon from '../../assets/icons/x-dark.svg'
import './ChatWidget.scss'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Floating chat launcher and popup (Figma #40). Shown only to signed-in users.
// The popup is a modal dialog: Escape closes it and Tab cycles inside it. On a
// phone it fills the screen (Figma "Mobile / 2 Inbox").
function ChatWidget() {
  const { isAuthenticated } = useAuth()
  const { isOpen, view, openInbox, close, openMerchantChat } = useChat()
  const popupRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  // Focus moves into the popup when it opens and back to the launcher when it
  // closes, so a keyboard user never loses their place.
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const launcher = launcherRef.current
    const popup = popupRef.current
    const first = popup?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    return () => launcher?.focus()
  }, [isOpen])

  if (!isAuthenticated) {
    return null
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }

    if (event.key !== 'Tab' || !popupRef.current) {
      return
    }

    const focusable = [...popupRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]

    if (focusable.length === 0) {
      return
    }

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

  return (
    <div className="chat">
      {isOpen ? (
        <div
          className="chat-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Chat"
          ref={popupRef}
          onKeyDown={handleKeyDown}
        >
          {view.kind === 'inbox' ? <ChatInbox /> : null}

          {view.kind === 'conversation' ? (
            <ChatConversation
              key={view.conversationId}
              conversationId={view.conversationId}
              title={view.title}
              subtitle={view.subtitle}
            />
          ) : null}

          {view.kind === 'opening' ? (
            <>
              <ChatHeader title={view.merchantName} subtitle="Penjual" onBack={openInbox} />
              <ChatState kind="loading" title="Membuka percakapan…" />
            </>
          ) : null}

          {view.kind === 'open-failed' ? (
            <>
              <ChatHeader title={view.merchantName} subtitle="Penjual" onBack={openInbox} />
              <ChatState
                kind="error"
                title="Gagal membuka percakapan"
                text={view.message}
                onRetry={() => openMerchantChat(view.merchantId, view.merchantName)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <button
        className={isOpen ? 'chat-launcher chat-launcher--open' : 'chat-launcher'}
        type="button"
        ref={launcherRef}
        aria-label={isOpen ? 'Tutup chat' : 'Buka chat'}
        aria-expanded={isOpen}
        onClick={isOpen ? close : openInbox}
      >
        <img src={isOpen ? closeIcon : chatIcon} alt="" width={20} height={20} />
        {isOpen ? null : <span>Chat</span>}
      </button>
    </div>
  )
}

export default ChatWidget
