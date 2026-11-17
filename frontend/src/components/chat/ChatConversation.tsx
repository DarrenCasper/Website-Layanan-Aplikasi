import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type UIEvent,
} from 'react'
import { useAuth } from '../../context/authContext'
import { useChat } from '../../context/chatContext'
import { isAbortError } from '../../lib/api'
import { isMissingRoute } from '../../lib/merchants'
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  fetchMessages,
  formatDayLabel,
  formatMessageTime,
  sendMessage,
  type ChatMessage,
} from '../../lib/chat'
import { usePolling } from '../../lib/usePolling'
import { ChatHeader, ChatState } from './ChatParts'
import alertIcon from '../../assets/icons/alert-small.svg'
import sendIcon from '../../assets/icons/send.svg'

// While a conversation is open, new messages are fetched on this interval.
const THREAD_POLL_MS = 5_000
// Within this many pixels of the top, scrolling loads the previous page.
const LOAD_OLDER_THRESHOLD = 40
// Within this many pixels of the bottom, new messages keep the view pinned.
const STICK_TO_BOTTOM_THRESHOLD = 80

type ThreadStatus = 'loading' | 'ready' | 'error'

type ChatConversationProps = {
  conversationId: string
  title: string
  subtitle: string
}

const isPending = (message: ChatMessage) => message.id.startsWith('local-')

/** Merges server messages into the list, dropping duplicates by id. */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(current.map((message) => message.id))
  const fresh = incoming.filter((message) => !known.has(message.id))

  if (fresh.length === 0) {
    return current
  }

  const sent = [...current.filter((message) => !isPending(message)), ...fresh].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )

  // Messages still being sent stay at the bottom until the server confirms them.
  return [...sent, ...current.filter(isPending)]
}

type Group = { key: string; day: string | null; mine: boolean; messages: ChatMessage[] }

function groupMessages(messages: ChatMessage[], userId: string | undefined): Group[] {
  const groups: Group[] = []
  let lastDay = ''

  for (const message of messages) {
    const day = formatDayLabel(message.createdAt)
    const mine = message.senderId === userId
    const previous = groups[groups.length - 1]
    const newDay = day !== lastDay

    if (previous && !newDay && previous.mine === mine) {
      previous.messages.push(message)
    } else {
      groups.push({ key: message.id, day: newDay ? day : null, mine, messages: [message] })
    }

    lastDay = day
  }

  return groups
}

// Open conversation (Figma 97:10134): the latest 30 messages, older pages on
// scroll up, polling for newer ones, and optimistic sends that can fail and be
// retried in place.
function ChatConversation({ conversationId, title, subtitle }: ChatConversationProps) {
  const { token, user } = useAuth()
  const { openInbox } = useChat()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ThreadStatus>('loading')
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // True while the backend lacks the message GET routes (#39): sending still
  // works, there is just no history or polling to show.
  const [historyMissing, setHistoryMissing] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Set before a prepend so the layout effect can keep the same message under
  // the reader's eye; set to "bottom" when the view should follow new messages.
  const scrollIntent = useRef<{ kind: 'bottom' } | { kind: 'keep'; fromBottom: number } | null>({
    kind: 'bottom',
  })

  const nearBottom = () => {
    const element = scrollRef.current

    return (
      !element ||
      element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_THRESHOLD
    )
  }

  // First page.
  useEffect(() => {
    if (!token) {
      return
    }

    const controller = new AbortController()

    fetchMessages(conversationId, {}, token, controller.signal).then(
      (page) => {
        scrollIntent.current = { kind: 'bottom' }
        setMessages(page)
        setHasOlder(page.length >= MESSAGE_PAGE_SIZE)
        setStatus('ready')
      },
      (error: unknown) => {
        if (isAbortError(error)) {
          return
        }

        if (isMissingRoute(error)) {
          setHistoryMissing(true)
          setStatus('ready')
          return
        }

        setStatus('error')
      },
    )

    return () => controller.abort()
  }, [conversationId, token, reloadKey])

  // The composer takes focus once the thread can be written to, so a buyer who
  // pressed "Chat penjual" can start typing straight away.
  useEffect(() => {
    if (status === 'ready') {
      inputRef.current?.focus()
    }
  }, [status])

  useLayoutEffect(() => {
    const element = scrollRef.current
    const intent = scrollIntent.current

    if (!element || !intent) {
      return
    }

    element.scrollTop =
      intent.kind === 'bottom' ? element.scrollHeight : element.scrollHeight - intent.fromBottom
    scrollIntent.current = null
  }, [messages])

  const lastServerId = [...messages].reverse().find((message) => !isPending(message))?.id

  const pollNewer = useCallback(() => {
    if (!token || status !== 'ready' || historyMissing) {
      return
    }

    fetchMessages(conversationId, lastServerId ? { after: lastServerId } : {}, token).then(
      (incoming) => {
        if (incoming.length === 0) {
          return
        }

        if (nearBottom()) {
          scrollIntent.current = { kind: 'bottom' }
        }

        setMessages((current) => mergeMessages(current, incoming))
      },
      () => {
        // A missed poll is retried on the next tick.
      },
    )
  }, [conversationId, token, status, lastServerId, historyMissing])

  usePolling(pollNewer, THREAD_POLL_MS, status === 'ready' && !historyMissing)

  const loadOlder = () => {
    const first = messages.find((message) => !isPending(message))

    if (!token || !first || loadingOlder || !hasOlder) {
      return
    }

    setLoadingOlder(true)

    fetchMessages(conversationId, { before: first.id }, token).then(
      (older) => {
        const element = scrollRef.current
        scrollIntent.current = {
          kind: 'keep',
          fromBottom: element ? element.scrollHeight - element.scrollTop : 0,
        }
        setHasOlder(older.length >= MESSAGE_PAGE_SIZE)
        setMessages((current) => mergeMessages(current, older))
        setLoadingOlder(false)
      },
      () => setLoadingOlder(false),
    )
  }

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop < LOAD_OLDER_THRESHOLD) {
      loadOlder()
    }
  }

  const deliver = (clientId: string, body: string) => {
    if (!token) {
      return
    }

    sendMessage(conversationId, body, token).then(
      (saved) => {
        setMessages((current) => {
          const withoutPending = current.filter((message) => message.id !== clientId)

          return mergeMessages(withoutPending, [saved])
        })
      },
      () => {
        setMessages((current) =>
          current.map((message) =>
            message.id === clientId ? { ...message, status: 'failed' } : message,
          ),
        )
      },
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()

    if (!body || !user) {
      return
    }

    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    scrollIntent.current = { kind: 'bottom' }
    setMessages((current) => [
      ...current,
      {
        id: clientId,
        senderId: user.id,
        body,
        createdAt: new Date().toISOString(),
        status: 'sending',
      },
    ])
    setDraft('')
    deliver(clientId, body)
  }

  const retrySend = (message: ChatMessage) => {
    setMessages((current) =>
      current.map((entry) => (entry.id === message.id ? { ...entry, status: 'sending' } : entry)),
    )
    deliver(message.id, message.body)
  }

  const groups = groupMessages(messages, user?.id)

  return (
    <>
      <ChatHeader title={title} subtitle={subtitle} onBack={openInbox} />

      {status === 'loading' ? <ChatState kind="loading" title="Memuat pesan…" /> : null}

      {status === 'error' ? (
        <ChatState
          kind="error"
          title="Gagal memuat percakapan"
          text="Periksa koneksimu, lalu coba lagi."
          onRetry={() => {
            setStatus('loading')
            setReloadKey((value) => value + 1)
          }}
        />
      ) : null}

      {status === 'ready' ? (
        <div
          className="chat-thread"
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label={`Pesan dengan ${title}`}
        >
          {loadingOlder ? <p className="chat-thread__older">Memuat pesan sebelumnya…</p> : null}

          {historyMissing ? (
            <p className="chat-thread__empty">
              Riwayat pesan belum bisa dimuat dari server. Pesan baru tetap terkirim.
            </p>
          ) : null}

          {messages.length === 0 && !historyMissing ? (
            <p className="chat-thread__empty">Belum ada pesan. Sapa {title} lebih dulu.</p>
          ) : null}

          {groups.map((group) => {
            const last = group.messages[group.messages.length - 1]

            return (
              <div className="chat-group-wrap" key={group.key}>
                {group.day ? <p className="chat-day">{group.day}</p> : null}

                <div className={group.mine ? 'chat-group chat-group--mine' : 'chat-group'}>
                  {group.messages.map((message, index) => (
                    <div className="chat-bubble-wrap" key={message.id}>
                      <p
                        className={[
                          'chat-bubble',
                          index === 0 ? 'chat-bubble--first' : '',
                          index === group.messages.length - 1 ? 'chat-bubble--last' : '',
                          message.status === 'sending' ? 'chat-bubble--sending' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {message.body}
                      </p>

                      {message.status === 'failed' ? (
                        <p className="chat-failed" role="alert">
                          <img src={alertIcon} alt="" width={13} height={13} />
                          <span className="chat-failed__label">Gagal terkirim</span>
                          <span aria-hidden="true">·</span>
                          <button type="button" onClick={() => retrySend(message)}>
                            Coba lagi
                          </button>
                        </p>
                      ) : null}
                    </div>
                  ))}

                  {last.status !== 'failed' ? (
                    <p className="chat-meta">
                      {last.status === 'sending' ? 'Mengirim…' : formatMessageTime(last.createdAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <form className="chat-compose" onSubmit={handleSubmit}>
        <input
          className="chat-compose__input"
          ref={inputRef}
          type="text"
          aria-label="Tulis pesan"
          placeholder="Tulis pesan…"
          maxLength={MESSAGE_MAX_LENGTH}
          value={draft}
          disabled={status !== 'ready'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="chat-compose__send"
          type="submit"
          aria-label="Kirim pesan"
          disabled={status !== 'ready' || draft.trim() === ''}
        >
          <img src={sendIcon} alt="" width={18} height={18} />
        </button>
      </form>
    </>
  )
}

export default ChatConversation
