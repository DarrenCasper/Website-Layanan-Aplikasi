// Filtering, sorting and the shape of the Explore page's filter state.
//
// Kept out of FilterPanel.tsx so that file exports only the panel component,
// which is what the fast-refresh rule wants, and so the page can share the same
// state type without importing the panel itself.

import type { CatalogProduct } from './catalog'

/** Sort orders offered by the panel. */
export type CatalogSort = 'terbaru' | 'termurah' | 'termahal' | 'terlaris'

/** Everything the panel controls. Owned by the page so the grid can read it. */
export type CatalogFilters = {
  tags: string[]
  minPrice: number | null
  maxPrice: number | null
  sort: CatalogSort
}

/** The state a freshly opened catalog starts in. */
export const DEFAULT_FILTERS: CatalogFilters = {
  tags: [],
  minPrice: null,
  maxPrice: null,
  sort: 'terbaru',
}

/**
 * Counts the filters that are actually narrowing the list.
 *
 * Sort is excluded on purpose. It reorders the results but never removes any,
 * so counting it would tell the user something is filtered when nothing is.
 */
export function countActiveFilters(filters: CatalogFilters): number {
  const priceActive = filters.minPrice !== null || filters.maxPrice !== null

  return filters.tags.length + (priceActive ? 1 : 0)
}

/** True when the price fields contradict each other. */
export function isPriceRangeInvalid(filters: CatalogFilters): boolean {
  return (
    filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice
  )
}

/**
 * Applies the panel's filters and sort to a loaded list.
 *
 * Filtering happens here rather than on the server because the catalog arrives
 * in one page of up to 50 items and the panel has to react as the user types.
 * Every rule is written so an empty filter means "keep everything", which is
 * what makes Reset a plain assignment back to DEFAULT_FILTERS.
 */
export function applyFilters(
  products: CatalogProduct[],
  filters: CatalogFilters,
): CatalogProduct[] {
  const priceActive = filters.minPrice !== null || filters.maxPrice !== null
  const priceUsable = priceActive && !isPriceRangeInvalid(filters)

  const matched = products.filter((product) => {
    if (filters.tags.length > 0 && !filters.tags.some((tag) => product.tags.includes(tag))) {
      return false
    }

    if (priceUsable) {
      if (filters.minPrice !== null && product.price < filters.minPrice) {
        return false
      }

      if (filters.maxPrice !== null && product.price > filters.maxPrice) {
        return false
      }
    }

    return true
  })

  if (filters.sort === 'terbaru') {
    // The backend exposes no creation timestamp, so "Terbaru" means the order
    // the catalog itself returns, which is its own newest-first ordering.
    return matched
  }

  // Sorts are copied before sorting so the caller's array is never reordered in
  // place, which would corrupt the source order "Terbaru" restores.
  const sorted = [...matched]

  if (filters.sort === 'termurah') {
    sorted.sort((a, b) => a.price - b.price)
  } else if (filters.sort === 'termahal') {
    sorted.sort((a, b) => b.price - a.price)
  } else {
    sorted.sort((a, b) => b.sold - a.sold)
  }

  return sorted
}

/** Turns a stored amount into the dotted form shown in the price fields. */
export function formatPriceInput(value: number | null): string {
  return value === null ? '' : value.toLocaleString('id-ID')
}

/** Reads a price field back into an amount, ignoring anything that is not a digit. */
export function parsePriceInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')

  return digits === '' ? null : Number(digits)
}
