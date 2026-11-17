import { createContext, useContext } from 'react'

export type ChatView =
  | { kind: 'inbox' }
  | { kind: 'opening'; merchantName: string }
  | { kind: 'open-failed'; merchantId: string; merchantName: string; message: string }
  | {
      kind: 'conversation'
      conversationId: string
      title: string
      subtitle: string
    }

export type ChatContextValue = {
  isOpen: boolean
  view: ChatView
  openInbox: () => void
  close: () => void
  showConversation: (conversationId: string, title: string, subtitle: string) => void
  /** "Chat penjual": opens (or creates) the conversation with one store. */
  openMerchantChat: (merchantId: string, merchantName: string) => void
}

// Split from ChatProvider.tsx for the react-refresh only-export-components rule,
// the same way the auth context is.
export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error('useChat must be used inside a ChatProvider')
  }

  return context
}
