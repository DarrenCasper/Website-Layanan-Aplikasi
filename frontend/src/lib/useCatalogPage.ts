import { useCallback, useEffect, useState } from 'react'
import { isAbortError, toErrorMessage } from './api'
import { fetchCatalogPage, type CatalogPage, type CatalogRequest } from './catalog'

export type CatalogPageState =
  | { status: 'loading'; page: CatalogPage | null }
  | { status: 'ready'; page: CatalogPage }
  | { status: 'error'; page: CatalogPage | null; message: string }

/**
 * Loads one page of the catalog for the given query.
 *
 * Every query change aborts the request before it, so a slow answer to an
 * older search can never overwrite the results of a newer one. The query is
 * compared by its serialised form, so callers may build a fresh object on
 * every render without re-fetching.
 */
export function useCatalogPage(query: CatalogRequest | null): {
  state: CatalogPageState
  retry: () => void
} {
  const key = query ? JSON.stringify(query) : null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<CatalogPageState>({ status: 'loading', page: null })
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // A new query flips back to loading during render, keeping the previous page
  // around so the grid does not collapse while the next one arrives.
  const requestKey = `${key}#${attempt}`
  if (loadedKey !== requestKey) {
    setLoadedKey(requestKey)
    setState((previous) => ({ status: 'loading', page: previous.page }))
  }

  useEffect(() => {
    if (key === null) {
      return
    }

    const controller = new AbortController()

    fetchCatalogPage(JSON.parse(key) as CatalogRequest, controller.signal).then(
      (page) => setState({ status: 'ready', page }),
      (error: unknown) => {
        if (isAbortError(error)) {
          return
        }

        setState((previous) => ({
          status: 'error',
          page: previous.page,
          message: toErrorMessage(error),
        }))
      },
    )

    return () => controller.abort()
  }, [key, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, retry }
}

/** Mirrors a value after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)

    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
