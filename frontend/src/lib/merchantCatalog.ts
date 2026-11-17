// Listing create, edit and delete for the merchant dashboard (#37), on the
// catalog routes that already exist:
//   POST   /catalog/merchants/:merchantId/products | services
//   PATCH  /catalog/merchants/:merchantId/products/:id | services/:id
//   DELETE /catalog/merchants/:merchantId/products/:id | services/:id
//
// Two gaps in today's backend are bridged here rather than in the UI:
//   - POST only reads name, price, stock/duration and tags, so a description is
//     written with a follow-up PATCH, and the category (issue #32) is sent but
//     ignored until that issue lands.
//   - The public catalog lists ACTIVE stores only, so a new (PENDING) store's
//     own listings would vanish on reload. Listings this browser saved are kept
//     in a small local cache and merged into the dashboard's list by id.

import { ApiError, request } from './api'
import type { CatalogType } from './categories'
import { fetchCatalogPage, toCatalogProduct, type ApiListing, type CatalogProduct } from './catalog'

export type ListingInput = {
  name: string
  price: number
  /** Stock for products, duration in minutes for services. */
  quantity: number
  description: string
  category: string
  tags: string[]
}

// Mirrors the backend's own validation so most mistakes are caught before a
// round trip (catalog.ts readListingBody / readCatalogUpdate).
export const LISTING_LIMITS = {
  nameMax: 100,
  descriptionMax: 5000,
  tagsMax: 10,
  tagMax: 20,
  priceMax: 2_147_483_647,
} as const

export type ListingField = keyof ListingInput

export type ListingErrors = Partial<Record<ListingField, string>>

export function validateListing(input: ListingInput, existingNames: string[]): ListingErrors {
  const errors: ListingErrors = {}
  const name = input.name.trim()

  if (!name) {
    errors.name = 'Nama wajib diisi'
  } else if (name.length > LISTING_LIMITS.nameMax) {
    errors.name = `Nama maksimal ${LISTING_LIMITS.nameMax} karakter`
  } else if (existingNames.some((entry) => entry.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = 'Nama ini sudah dipakai produk lain di tokomu'
  }

  if (!Number.isInteger(input.price) || input.price < 0 || input.price > LISTING_LIMITS.priceMax) {
    errors.price = 'Harga harus angka bulat 0 atau lebih'
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    errors.quantity = 'Isi dengan angka bulat 0 atau lebih'
  }

  if (!input.category) {
    errors.category = 'Pilih satu kategori'
  }

  if (input.tags.length > LISTING_LIMITS.tagsMax) {
    errors.tags = `Maksimal ${LISTING_LIMITS.tagsMax} tag`
  }

  if (input.description.length > LISTING_LIMITS.descriptionMax) {
    errors.description = `Deskripsi maksimal ${LISTING_LIMITS.descriptionMax} karakter`
  }

  return errors
}

/** Normalises one tag the way the backend stores it. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().slice(0, LISTING_LIMITS.tagMax)
}

/**
 * Maps a backend 400/409 onto the form field it is about, so the message shows
 * under the right input instead of as a generic banner.
 */
export function fieldForApiError(error: ApiError): ListingField | null {
  const message = error.message.toLowerCase()

  if (error.status === 409 || message.includes('tag')) return 'tags'
  if (message.includes('name')) return 'name'
  if (message.includes('price')) return 'price'
  if (message.includes('stock') || message.includes('duration')) return 'quantity'
  if (message.includes('description')) return 'description'
  if (message.includes('categor')) return 'category'

  return null
}

// --- local cache ---------------------------------------------------------------

type CachedListing = { listing: CatalogProduct; category: string; savedAt: number }
type CacheStore = Record<string, CachedListing>

const cacheKey = (merchantId: string) => `layap.listings.${merchantId}`

function readCache(merchantId: string): CacheStore {
  try {
    const raw = window.localStorage.getItem(cacheKey(merchantId))
    const parsed = raw ? (JSON.parse(raw) as CacheStore) : {}

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(merchantId: string, store: CacheStore) {
  try {
    window.localStorage.setItem(cacheKey(merchantId), JSON.stringify(store))
  } catch {
    // Storage may be unavailable; the list in memory is still correct.
  }
}

function remember(merchantId: string, listing: CatalogProduct, category: string) {
  writeCache(merchantId, {
    ...readCache(merchantId),
    [listing.id]: { listing: { ...listing, category }, category, savedAt: Date.now() },
  })
}

function forget(merchantId: string, listingId: string) {
  const store = readCache(merchantId)
  delete store[listingId]
  writeCache(merchantId, store)
}

// --- reads -----------------------------------------------------------------------

export type MerchantListings = {
  items: CatalogProduct[]
  /** Category slug per listing id, for the table's badge. */
  categories: Record<string, string>
}

/**
 * The store's own listings of one type: the public catalog filtered by
 * merchantId, merged with what this browser saved.
 */
export async function loadMerchantListings(
  merchantId: string,
  type: CatalogType,
  signal?: AbortSignal,
): Promise<MerchantListings> {
  const cache = readCache(merchantId)
  let remote: CatalogProduct[] = []

  try {
    const page = await fetchCatalogPage({ type, merchantId, limit: 50 }, signal)
    remote = page.items
  } catch (error) {
    // A pending store may simply not be listed yet; anything else is real.
    if (!(error instanceof ApiError) || error.status >= 500 || error.status === 0) {
      throw error
    }
  }

  const byId = new Map<string, CatalogProduct>()
  const categories: Record<string, string> = {}

  for (const entry of Object.values(cache)) {
    if (entry.listing.kind === type) {
      byId.set(entry.listing.id, entry.listing)
      categories[entry.listing.id] = entry.category
    }
  }

  for (const item of remote) {
    const cached = byId.get(item.id)
    byId.set(
      item.id,
      cached
        ? { ...item, description: cached.description, rawDescription: cached.rawDescription }
        : item,
    )
    if (item.category && !categories[item.id]) categories[item.id] = item.category
  }

  return {
    items: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'id')),
    categories,
  }
}

// --- writes ------------------------------------------------------------------------

const segment = (type: CatalogType) => (type === 'service' ? 'services' : 'products')
const quantityField = (type: CatalogType) => (type === 'service' ? 'durationMin' : 'stock')

/** Fields a save could not store because the backend does not support them yet. */
export type SaveResult = { listing: CatalogProduct; unsaved: ListingField[] }

export async function createListing(
  merchantId: string,
  type: CatalogType,
  input: ListingInput,
  token: string,
): Promise<SaveResult> {
  const response = await request<{ data: ApiListing }>(
    `/catalog/merchants/${encodeURIComponent(merchantId)}/${segment(type)}`,
    {
      method: 'POST',
      token,
      body: {
        name: input.name.trim(),
        price: input.price,
        [quantityField(type)]: input.quantity,
        tags: input.tags,
        category: input.category,
      },
    },
  )
  let listing = toCatalogProduct(response.data, type)

  // POST does not read the description, so it is written straight after.
  if (input.description.trim()) {
    try {
      const patched = await request<{ data: ApiListing }>(
        `/catalog/merchants/${encodeURIComponent(merchantId)}/${segment(type)}/${encodeURIComponent(listing.id)}`,
        { method: 'PATCH', token, body: { description: input.description.trim() } },
      )
      listing = toCatalogProduct(patched.data, type)
    } catch {
      listing = {
        ...listing,
        description: input.description.trim(),
        rawDescription: input.description.trim(),
      }
    }
  }

  remember(merchantId, listing, input.category)

  return { listing, unsaved: [] }
}

export async function updateListing(
  merchantId: string,
  type: CatalogType,
  original: CatalogProduct,
  originalCategory: string,
  input: ListingInput,
  token: string,
): Promise<SaveResult> {
  const path = `/catalog/merchants/${encodeURIComponent(merchantId)}/${segment(type)}/${encodeURIComponent(original.id)}`
  const base: Record<string, unknown> = {
    name: input.name.trim(),
    price: input.price,
    [quantityField(type)]: input.quantity,
    description: input.description.trim() || null,
  }
  const tagsChanged = [...input.tags].sort().join('|') !== [...original.tags].sort().join('|')
  const extras: Record<string, unknown> = {}

  if (input.category !== originalCategory) extras.category = input.category
  if (tagsChanged) extras.tags = input.tags

  let unsaved: ListingField[] = []
  let response: { data: ApiListing }

  try {
    response = await request<{ data: ApiListing }>(path, {
      method: 'PATCH',
      token,
      body: { ...base, ...extras },
    })
  } catch (error) {
    // Today's PATCH rejects category and tags outright; save everything else
    // and tell the form which changes are still waiting on the backend.
    const rejectsExtras =
      error instanceof ApiError &&
      error.status === 400 &&
      /cannot update field/i.test(error.message) &&
      Object.keys(extras).length > 0

    if (!rejectsExtras) {
      throw error
    }

    response = await request<{ data: ApiListing }>(path, { method: 'PATCH', token, body: base })
    unsaved = [
      ...(tagsChanged ? (['tags'] as const) : []),
      ...(input.category !== originalCategory ? (['category'] as const) : []),
    ]
  }

  const listing = toCatalogProduct(response.data, type)
  // The category badge is kept locally until the backend stores categories.
  remember(merchantId, listing, input.category)

  return { listing, unsaved }
}

export async function deleteListing(
  merchantId: string,
  type: CatalogType,
  listingId: string,
  token: string,
): Promise<void> {
  try {
    await request(
      `/catalog/merchants/${encodeURIComponent(merchantId)}/${segment(type)}/${encodeURIComponent(listingId)}`,
      { method: 'DELETE', token },
    )
  } catch (error) {
    // Already gone is the outcome the user asked for.
    if (!(error instanceof ApiError && error.status === 404 && !/no route/i.test(error.message))) {
      throw error
    }
  }

  forget(merchantId, listingId)
}
