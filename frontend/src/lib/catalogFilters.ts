// The filter panel's state, its URL form, and the small helpers both share.
//
// Kept out of FilterPanel.tsx so that file exports only the panel component,
// which is what the fast-refresh rule wants, and so the pages can share the same
// state type without importing the panel itself.

import type { CatalogType } from './categories'

/** Sort orders the catalog API accepts. Nothing else is offered. */
export type CatalogSort = 'default' | 'price_asc' | 'price_desc'

export const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'default', label: 'Paling sesuai' },
  { value: 'price_asc', label: 'Harga terendah' },
  { value: 'price_desc', label: 'Harga tertinggi' },
]

/** Everything the panel controls. Owned by the page so the grid can read it. */
export type CatalogFilters = {
  type: CatalogType
  /** One category slug, or null for "Semua kategori". */
  category: string | null
  minPrice: number | null
  maxPrice: number | null
  sort: CatalogSort
}

/** The state a freshly opened catalog starts in. */
export const DEFAULT_FILTERS: CatalogFilters = {
  type: 'product',
  category: null,
  minPrice: null,
  maxPrice: null,
  sort: 'default',
}

/**
 * Counts the filters that are actually narrowing the list: the category and
 * the price range. Sort reorders without removing anything and the product or
 * service toggle picks a catalog rather than narrowing one, so neither counts.
 */
export function countActiveFilters(filters: CatalogFilters): number {
  const priceActive = filters.minPrice !== null || filters.maxPrice !== null

  return (filters.category ? 1 : 0) + (priceActive ? 1 : 0)
}

/** True when the price fields contradict each other. */
export function isPriceRangeInvalid(filters: CatalogFilters): boolean {
  return (
    filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice
  )
}

/** Turns a stored amount into the dotted form shown in the price fields. */
export function formatPriceInput(value: number | null): string {
  return value === null ? '' : value.toLocaleString('id-ID')
}

// The API caps prices at a signed 32-bit integer, so longer input is clipped
// rather than sent and rejected.
const MAX_PRICE_DIGITS = 10
const MAX_PRICE = 2_147_483_647

/** Reads a price field back into an amount, ignoring anything that is not a digit. */
export function parsePriceInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_PRICE_DIGITS)

  return digits === '' ? null : Math.min(Number(digits), MAX_PRICE)
}

/** Short price for chips and hints, e.g. `Rp 99 rb`, `Rp 1,5 jt`. */
export function formatPriceShort(value: number): string {
  const trim = (amount: number) =>
    amount.toLocaleString('id-ID', { maximumFractionDigits: amount < 10 ? 1 : 0 })

  if (value >= 1_000_000_000) {
    return `Rp ${trim(value / 1_000_000_000)} M`
  }

  if (value >= 1_000_000) {
    return `Rp ${trim(value / 1_000_000)} jt`
  }

  if (value >= 1_000) {
    return `Rp ${trim(value / 1_000)} rb`
  }

  return `Rp ${value}`
}

/** Chip label for an active price range, e.g. `Rp 1 jt sampai 50 jt`. */
export function formatPriceRange(minPrice: number | null, maxPrice: number | null): string {
  if (minPrice !== null && maxPrice !== null) {
    return `${formatPriceShort(minPrice)} sampai ${formatPriceShort(maxPrice).replace('Rp ', '')}`
  }

  if (minPrice !== null) {
    return `Mulai ${formatPriceShort(minPrice)}`
  }

  return `Sampai ${formatPriceShort(maxPrice ?? 0)}`
}

// --- URL state ---------------------------------------------------------------
//
// The Explore page mirrors its filters in the address bar (?q=&category=&type=
// &minPrice=&maxPrice=&sort=&page=), so a refresh or a shared link restores the
// same results and the back button steps through earlier searches.

export type CatalogQuery = CatalogFilters & {
  q: string
  page: number
}

export const DEFAULT_QUERY: CatalogQuery = { ...DEFAULT_FILTERS, q: '', page: 1 }

function readPrice(value: string | null): number | null {
  return value === null ? null : parsePriceInput(value)
}

export function queryFromSearchParams(params: URLSearchParams): CatalogQuery {
  const type = params.get('type') === 'service' ? 'service' : 'product'
  const rawSort = params.get('sort')
  const sort: CatalogSort =
    rawSort === 'price_asc' || rawSort === 'price_desc' ? rawSort : 'default'
  const page = Number.parseInt(params.get('page') ?? '1', 10)

  return {
    type,
    q: (params.get('q') ?? '').slice(0, 100),
    category: params.get('category') || null,
    minPrice: readPrice(params.get('minPrice')),
    maxPrice: readPrice(params.get('maxPrice')),
    sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** Only non-default values are written, so the default page has a clean URL. */
export function queryToSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams()

  if (query.q.trim()) params.set('q', query.q.trim())
  if (query.type !== 'product') params.set('type', query.type)
  if (query.category) params.set('category', query.category)
  if (query.minPrice !== null) params.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== null) params.set('maxPrice', String(query.maxPrice))
  if (query.sort !== 'default') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))

  return params
}
