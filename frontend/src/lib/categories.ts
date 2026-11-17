// Catalog categories for the filter panel and the merchant listing form.
//
// The backend's category API (issue #32) lists hardcoded "specific" categories
// plus broad "fallback" ones that catch anything without a better match. Until
// that endpoint is deployed this module answers with the same list the Figma
// frames show, behind the same type, so switching to live data needs no change
// anywhere else: `loadCategories` already tries the endpoint first.

import { request } from './api'

export type CatalogType = 'product' | 'service'

export type CategoryKind = 'specific' | 'fallback'

export type Category = {
  /** Value sent to the API as `category=`. */
  slug: string
  name: string
  kind: CategoryKind
  /** Which catalog the category belongs to. Absent means both. */
  appliesTo?: CatalogType
}

// Mirrors the Figma filter panel (#34) and the add/edit listing modals (#37).
export const MOCK_CATEGORIES: Category[] = [
  { slug: 'komputer-laptop', name: 'Komputer & Laptop', kind: 'specific', appliesTo: 'product' },
  { slug: 'komponen-pc', name: 'Komponen PC', kind: 'specific', appliesTo: 'product' },
  { slug: 'elektronik', name: 'Elektronik', kind: 'specific', appliesTo: 'product' },
  {
    slug: 'alat-lab-praktikum',
    name: 'Alat Lab & Praktikum',
    kind: 'specific',
    appliesTo: 'product',
  },
  { slug: 'buku-alat-tulis', name: 'Buku & Alat Tulis', kind: 'specific', appliesTo: 'product' },
  { slug: 'servis-elektronik', name: 'Servis Elektronik', kind: 'specific', appliesTo: 'service' },
  { slug: 'rakit-pc', name: 'Rakit & Instal PC', kind: 'specific', appliesTo: 'service' },
  { slug: 'les-bimbingan', name: 'Les & Bimbingan', kind: 'specific', appliesTo: 'service' },
  { slug: 'barang-lainnya', name: 'Barang Lainnya', kind: 'fallback', appliesTo: 'product' },
  { slug: 'jasa-lainnya', name: 'Jasa Lainnya', kind: 'fallback', appliesTo: 'service' },
]

type ApiCategory = {
  id?: unknown
  slug?: unknown
  name?: unknown
  kind?: unknown
  type?: unknown
  isFallback?: unknown
  fallback?: unknown
  appliesTo?: unknown
  scope?: unknown
}

function readKind(entry: ApiCategory): CategoryKind {
  if (entry.isFallback === true || entry.fallback === true) {
    return 'fallback'
  }

  const raw = String(entry.kind ?? entry.type ?? '').toLowerCase()

  return raw === 'fallback' || raw === 'umum' || raw === 'general' ? 'fallback' : 'specific'
}

function readAppliesTo(entry: ApiCategory): CatalogType | undefined {
  const raw = String(entry.appliesTo ?? entry.scope ?? '').toLowerCase()

  if (raw === 'product' || raw === 'products') {
    return 'product'
  }

  if (raw === 'service' || raw === 'services') {
    return 'service'
  }

  return undefined
}

// The endpoint's exact field names are not fixed yet, so every plausible
// spelling is accepted and anything without a usable name is dropped.
function toCategory(entry: ApiCategory): Category | null {
  const name = typeof entry.name === 'string' ? entry.name.trim() : ''
  const slugSource = entry.slug ?? entry.id

  if (!name || (typeof slugSource !== 'string' && typeof slugSource !== 'number')) {
    return null
  }

  return {
    slug: String(slugSource),
    name,
    kind: readKind(entry),
    appliesTo: readAppliesTo(entry),
  }
}

/** GET /catalog/categories, mapped onto the panel's shape. */
export async function fetchCategories(): Promise<Category[]> {
  const response = await request<{ data?: ApiCategory[] } | ApiCategory[]>('/catalog/categories')
  const rows = Array.isArray(response) ? response : (response?.data ?? [])

  return rows.map(toCategory).filter((entry): entry is Category => entry !== null)
}

/** Live categories when the endpoint answers with some, the mock list otherwise. */
export async function loadCategories(): Promise<Category[]> {
  try {
    const categories = await fetchCategories()

    if (categories.length > 0) {
      return categories
    }
  } catch {
    // The endpoint is not deployed yet; the mock list keeps the panel usable.
  }

  return MOCK_CATEGORIES
}

/** Categories that apply to one catalog, specific ones first. */
export function categoriesFor(categories: Category[], type: CatalogType): Category[] {
  const matching = categories.filter((entry) => !entry.appliesTo || entry.appliesTo === type)

  return [
    ...matching.filter((entry) => entry.kind === 'specific'),
    ...matching.filter((entry) => entry.kind === 'fallback'),
  ]
}

export function findCategory(categories: Category[], slug: string | null): Category | undefined {
  return slug ? categories.find((entry) => entry.slug === slug) : undefined
}
