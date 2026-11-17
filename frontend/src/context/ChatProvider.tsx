import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChatContext, type ChatContextValue, type ChatView } from './chatContext'
import { useAuth } from './authContext'
import { toErrorMessage } from '../lib/api'
import { openConversation } from '../lib/chat'

// Owns whether the chat popup is open and what it shows, so any page's
// "Chat penjual" button can open it straight to one store's conversation.
function ChatProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<ChatView>({ kind: 'inbox' })

  const openInbox = useCallback(() => {
    setView({ kind: 'inbox' })
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const showConversation = useCallback(
    (conversationId: string, title: string, subtitle: string) => {
      setView({ kind: 'conversation', conversationId, title, subtitle })
      setIsOpen(true)
    },
    [],
  )

  const openMerchantChat = useCallback(
    (merchantId: string, merchantName: string) => {
      // A visitor without a session signs in first and comes back here.
      if (!isAuthenticated || !token) {
        navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
        return
      }

      setView({ kind: 'opening', merchantName })
      setIsOpen(true)

      openConversation(merchantId, token).then(
        (conversationId) =>
          setView({
            kind: 'conversation',
            conversationId,
            title: merchantName,
            subtitle: 'Penjual',
          }),
        (error: unknown) =>
          setView({
            kind: 'open-failed',
            merchantId,
            merchantName,
            message: toErrorMessage(error),
          }),
      )
    },
    [isAuthenticated, token, navigate, location.pathname, location.search],
  )

  const value = useMemo<ChatContextValue>(
    () => ({ isOpen, view, openInbox, close, showConversation, openMerchantChat }),
    [isOpen, view, openInbox, close, showConversation, openMerchantChat],
  )

  return <ChatContext value={value}>{children}</ChatContext>
}

export default ChatProvider
