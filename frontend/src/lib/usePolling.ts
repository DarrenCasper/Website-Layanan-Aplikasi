import { useEffect, useRef, useState } from 'react'

function isTabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

/** Tracks whether the browser tab is in the foreground. */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(isTabVisible)

  useEffect(() => {
    const handleChange = () => setVisible(isTabVisible())

    document.addEventListener('visibilitychange', handleChange)

    return () => document.removeEventListener('visibilitychange', handleChange)
  }, [])

  return visible
}

/**
 * Calls `callback` every `intervalMs` while `enabled` is true and the tab is
 * visible. Hiding the tab stops the timer outright rather than letting the
 * browser throttle it, and showing it again polls once immediately so the view
 * catches up. The latest callback is always the one called.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled: boolean): void {
  const savedCallback = useRef(callback)
  const visible = useTabVisible()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const active = enabled && visible
  const wasActive = useRef(active)

  useEffect(() => {
    if (!active) {
      wasActive.current = false
      return
    }

    // Coming back from a hidden tab: catch up straight away.
    if (!wasActive.current) {
      savedCallback.current()
    }

    wasActive.current = true
    const timer = window.setInterval(() => savedCallback.current(), intervalMs)

    return () => window.clearInterval(timer)
  }, [active, intervalMs])
}
