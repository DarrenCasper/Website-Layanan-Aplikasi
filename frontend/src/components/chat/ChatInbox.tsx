import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/authContext'
import { useChat } from '../../context/chatContext'
import { isAbortError } from '../../lib/api'
import { fetchConversations, formatInboxTime, type Conversation } from '../../lib/chat'
import { initialsOf, isMissingRoute } from '../../lib/merchants'
import { usePolling } from '../../lib/usePolling'
import { ChatHeader, ChatState } from './ChatParts'

// While only the inbox is open it refreshes on this interval.
const INBOX_POLL_MS = 15_000

type Filter = 'all' | 'store'

type InboxState =
  | { status: 'loading' }
  | { status: 'ready'; conversations: Conversation[] }
  | { status: 'error'; message: string }

// Inbox list (Figma 97:10049). "Toko saya" narrows the list to buyers writing
// to a store the user is a member of; those rows carry a "Pembeli · untuk"
// line so a merchant can tell which store a buyer wrote to.
function ChatInbox() {
  const { token, user } = useAuth()
  const { showConversation } = useChat()
  const [state, setState] = useState<InboxState>({ status: 'loading' })
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!token || !user) {
        return
      }

      fetchConversations(token, user.id, signal).then(
        (conversations) => setState({ status: 'ready', conversations }),
        (error: unknown) => {
          if (isAbortError(error)) {
            return
          }

          // A failed background refresh keeps the list already on screen.
          setState((previous) =>
            previous.status === 'ready'
              ? previous
              : {
                  status: 'error',
                  // Until the inbox route (#39) is deployed, say so plainly
                  // instead of blaming the connection.
                  message: isMissingRoute(error)
                    ? 'Daftar chat belum tersedia di server. Kamu tetap bisa mengirim pesan lewat tombol Chat penjual.'
                    : 'Periksa koneksimu, lalu coba lagi.',
                },
          )
        },
      )
    },
    [token, user],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)

    return () => controller.abort()
  }, [load])

  usePolling(() => load(), INBOX_POLL_MS, state.status !== 'error')

  const retry = () => {
    setState({ status: 'loading' })
    load()
  }

  const conversations = state.status === 'ready' ? state.conversations : []
  const hasStoreChats = conversations.some((entry) => entry.role === 'merchant')
  const visible =
    filter === 'store' ? conversations.filter((entry) => entry.role === 'merchant') : conversations

  return (
    <>
      <ChatHeader title="Chat" />

      {state.status === 'ready' && conversations.length > 0 ? (
        <div className="chat-tabs" role="tablist" aria-label="Saring percakapan">
          {(
            [
              ['all', 'Semua'],
              ['store', 'Toko saya'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={filter === value ? 'chat-tab chat-tab--on' : 'chat-tab'}
              type="button"
              role="tab"
              aria-selected={filter === value}
              key={value}
              disabled={value === 'store' && !hasStoreChats}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {state.status === 'loading' ? <ChatState kind="loading" title="Memuat percakapan…" /> : null}

      {state.status === 'error' ? (
        <ChatState
          kind="error"
          title="Gagal memuat percakapan"
          text={state.message}
          onRetry={retry}
        />
      ) : null}

      {state.status === 'ready' && visible.length === 0 ? (
        <ChatState
          kind="empty"
          title="Belum ada percakapan"
          text="Mulai chat dari halaman produk atau toko lewat tombol Chat penjual."
        />
      ) : null}

      {visible.length > 0 ? (
        <ul className="chat-list">
          {visible.map((conversation) => {
            const isMerchantSide = conversation.role === 'merchant'
            const name = isMerchantSide ? conversation.buyerName : conversation.merchantName
            const last = conversation.lastMessage
            const preview = last
              ? `${last.senderId === user?.id ? 'Kamu: ' : ''}${last.body}`
              : 'Belum ada pesan'
            const subtitle = isMerchantSide
              ? `Pembeli · untuk ${conversation.merchantName}`
              : 'Penjual'

            return (
              <li key={conversation.id}>
                <button
                  className="chat-row"
                  type="button"
                  onClick={() => showConversation(conversation.id, name, subtitle)}
                >
                  <span className="chat-avatar" aria-hidden="true">
                    {initialsOf(name)}
                  </span>
                  <span className="chat-row__text">
                    <span className="chat-row__top">
                      <span className="chat-row__name">{name}</span>
                      <span className="chat-row__time">
                        {formatInboxTime(last?.createdAt ?? conversation.updatedAt)}
                      </span>
                    </span>
                    {isMerchantSide ? <span className="chat-row__role">{subtitle}</span> : null}
                    <span className="chat-row__preview">{preview}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </>
  )
}

export default ChatInbox
