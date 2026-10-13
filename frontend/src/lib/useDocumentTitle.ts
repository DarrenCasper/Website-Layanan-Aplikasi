import { useEffect } from 'react'

// Every catalog screen ends its title with the brand so a tab or a history
// entry is identifiable at a glance, the way a marketplace page normally is.
export const CATALOG_BRAND = 'Temu'

/** Title used by the Explore screen, and as the fallback while a product loads. */
export const CATALOG_TITLE = `Katalog Barang | ${CATALOG_BRAND}`

/** Builds a detail-page title from a product name. */
export function productTitle(name: string): string {
  return `${name} | ${CATALOG_BRAND}`
}

/**
 * Keeps `document.title` in step with the screen that is mounted.
 *
 * Nothing is restored on unmount on purpose. The next screen sets its own title
 * during the same commit, so restoring here would flash the outgoing page's
 * title for a frame before the incoming one replaced it.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
