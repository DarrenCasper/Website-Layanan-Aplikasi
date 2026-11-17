// Chat API for the buyer/merchant popup (#40).
//
// Sending and opening a conversation use the routes that already exist
// (POST /chat/conversation, POST /chat/conversation/:id/messages). Reading uses
// the GET routes from the backend issue #39:
//   GET /chat/conversations                         inbox, newest first
//   GET /chat/conversation/:id/messages?limit=30    latest page
//          ...&before=<messageId>                  older page (scroll up)
//          ...&after=<messageId>                   anything newer (polling)
// The adapters accept every reasonable field spelling so the popup does not
// break on small differences in the final response shape.

import { request } from './api'

export type ChatRole = 'buyer' | 'merchant'

export type Conversation = {
  id: string
  merchantId: string
  merchantName: string
  buyerId: string
  buyerName: string
  /** The signed-in user's side of this conversation. */
  role: ChatRole
  lastMessage: { body: string; senderId: string; createdAt: string } | null
  updatedAt: string
}

export type MessageStatus = 'sent' | 'sending' | 'failed'

export type ChatMessage = {
  /** Server id, or a client id while the message is still being sent. */
  id: string
  senderId: string
  body: string
  createdAt: string
  status: MessageStatus
}

export const MESSAGE_PAGE_SIZE = 30
export const MESSAGE_MAX_LENGTH = 2000

type ApiConversation = {
  id: string
  merchantId?: string
  buyerId?: string
  updatedAt?: string
  createdAt?: string
  role?: string
  merchant?: { id?: string; namaToko?: string }
  buyer?: { id?: string; namaLengkap?: string; username?: string }
  lastMessage?: ApiMessage | null
  messages?: ApiMessage[]
}

type ApiMessage = {
  id: string
  senderId?: string
  sender?: { id?: string }
  body: string
  createdAt: string
}

function toMessage(message: ApiMessage): ChatMessage {
  return {
    id: message.id,
    senderId: message.sender?.id ?? message.senderId ?? '',
    body: message.body,
    createdAt: message.createdAt,
    status: 'sent',
  }
}

function toConversation(entry: ApiConversation, userId: string): Conversation {
  const buyerId = entry.buyer?.id ?? entry.buyerId ?? ''
  const last = entry.lastMessage ?? entry.messages?.[0] ?? null
  const role: ChatRole =
    entry.role === 'merchant' || entry.role === 'MERCHANT' || (buyerId !== '' && buyerId !== userId)
      ? 'merchant'
      : 'buyer'

  return {
    id: entry.id,
    merchantId: entry.merchant?.id ?? entry.merchantId ?? '',
    merchantName: entry.merchant?.namaToko ?? 'Toko',
    buyerId,
    buyerName: entry.buyer?.namaLengkap ?? entry.buyer?.username ?? 'Pembeli',
    role,
    lastMessage: last
      ? { body: last.body, senderId: toMessage(last).senderId, createdAt: last.createdAt }
      : null,
    updatedAt: entry.updatedAt ?? last?.createdAt ?? entry.createdAt ?? new Date(0).toISOString(),
  }
}

function rowsOf<T>(response: { data?: T[] } | T[] | null): T[] {
  if (Array.isArray(response)) {
    return response
  }

  return Array.isArray(response?.data) ? response.data : []
}

/** GET /chat/conversations */
export async function fetchConversations(
  token: string,
  userId: string,
  signal?: AbortSignal,
): Promise<Conversation[]> {
  const response = await request<{ data?: ApiConversation[] } | ApiConversation[]>(
    '/chat/conversations',
    { token, signal },
  )

  return rowsOf(response)
    .map((entry) => toConversation(entry, userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

type MessageCursor = { before?: string; after?: string }

/** GET /chat/conversation/:id/messages, returned oldest first. */
export async function fetchMessages(
  conversationId: string,
  cursor: MessageCursor,
  token: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) })

  if (cursor.before) params.set('before', cursor.before)
  if (cursor.after) params.set('after', cursor.after)

  const response = await request<{ data?: ApiMessage[] } | ApiMessage[]>(
    `/chat/conversation/${encodeURIComponent(conversationId)}/messages?${params}`,
    { token, signal },
  )

  return rowsOf(response)
    .map(toMessage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

/** POST /chat/conversation. Returns the existing conversation if there is one. */
export async function openConversation(merchantId: string, token: string): Promise<string> {
  const response = await request<{ data: { id: string } }>('/chat/conversation', {
    method: 'POST',
    body: { merchantId },
    token,
  })

  return response.data.id
}

/** POST /chat/conversation/:id/messages */
export async function sendMessage(
  conversationId: string,
  body: string,
  token: string,
): Promise<ChatMessage> {
  const response = await request<{ data: ApiMessage }>(
    `/chat/conversation/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', body: { body }, token },
  )

  return toMessage(response.data)
}

const TIME = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })
const DAY_MONTH = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Inbox time: "23.04" today, "Kemarin", then "12 Nov". */
export function formatInboxTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (days <= 0) return TIME.format(date)
  if (days === 1) return 'Kemarin'

  return DAY_MONTH.format(date)
}

/** Day separator label: "Hari ini", "Kemarin", or "12 Nov". */
export function formatDayLabel(iso: string, now = new Date()): string {
  const label = formatInboxTime(iso, now)

  return label.includes('.') || label.includes(':') ? 'Hari ini' : label
}

export function formatMessageTime(iso: string): string {
  return TIME.format(new Date(iso))
}
