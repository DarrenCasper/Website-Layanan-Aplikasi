// Catalog data layer shared by Explore, the storefront, the product detail page
// and the merchant dashboard.
//
// The backend's Product and Service models carry name, price, stock (or
// duration), description and tags, so the artwork, rating and sold count the
// designs show are filled in locally: images come from the Figma asset pool and
// the numeric extras are derived deterministically from the id, so a listing
// looks the same on every render.

import { request } from './api'
import type { CatalogType } from './categories'
import type { CatalogQuery } from './catalogFilters'
import { GALLERY_FRAME_COUNT, buildGallery, mockProducts, productImages } from './mockCatalog'

export type CatalogProduct = {
  id: string
  /** Product or service. Services carry a duration instead of stock. */
  kind: CatalogType
  name: string
  price: number
  image: string
  /**
   * Photos for the detail page's gallery. The first entry is the main image and
   * matches `image`. The backend stores no pictures yet, so these are filled
   * from the local asset pool the same way `image` already is.
   */
  gallery: string[]
  rating: number
  sold: number
  stock: number
  durationMin: number | null
  description: string
  /** The description exactly as stored, empty when there is none. */
  rawDescription: string
  merchantId: string | null
  merchantName: string
  merchantCity: string
  variants: string[]
  tags: string[]
  /** Category name when the backend sends one (issue #32). */
  category: string | null
  section: string
}

export type CatalogPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CatalogPage = {
  items: CatalogProduct[]
  pagination: CatalogPagination
}

/** Formats an integer amount the way the designs do, e.g. `Rp 64.000.000`. */
export function formatRupiah(value: number): string {
  const grouped = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `Rp ${grouped}`
}

// Small stable string hash. The same id always yields the same picture and the
// same rating, so a product does not change appearance between renders.
function hashId(id: string): number {
  let hash = 0

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1_000_003
  }

  return hash
}

type ApiTagLink = {
  tag: { name: string }
}

type ApiCategoryRef = { name?: string } | string | null | undefined

export type ApiListing = {
  id: string
  name: string
  price: number
  stock?: number
  durationMin?: number
  description: string | null
  merchantId?: string
  merchant?: { id?: string; namaToko?: string }
  productTags?: ApiTagLink[]
  serviceTags?: ApiTagLink[]
  category?: ApiCategoryRef
}

type ApiListingPage = {
  data?: ApiListing[]
  pagination?: Partial<CatalogPagination>
}

function readCategoryName(category: ApiCategoryRef): string | null {
  if (!category) {
    return null
  }

  return typeof category === 'string' ? category : (category.name ?? null)
}

export function toCatalogProduct(listing: ApiListing, kind: CatalogType): CatalogProduct {
  const seed = hashId(listing.id)
  const merchantName = listing.merchant?.namaToko ?? 'Toko Layap'
  const image = productImages[seed % productImages.length]
  const tagLinks = (kind === 'product' ? listing.productTags : listing.serviceTags) ?? []

  return {
    id: listing.id,
    kind,
    name: listing.name,
    price: listing.price,
    image,
    gallery: buildGallery(listing.id, image, GALLERY_FRAME_COUNT),
    // 3.0 - 5.0, one decimal, matching the range the design cards show.
    rating: Number((3 + (seed % 21) / 10).toFixed(1)),
    sold: seed % 120,
    stock: listing.stock ?? 0,
    durationMin: kind === 'service' ? (listing.durationMin ?? 0) : null,
    description:
      listing.description?.trim() ||
      `Dijual oleh ${merchantName}. Silakan hubungi penjual untuk informasi lebih lanjut.`,
    rawDescription: listing.description?.trim() ?? '',
    merchantId: listing.merchant?.id ?? listing.merchantId ?? null,
    merchantName,
    merchantCity: 'Kota Surabaya',
    variants: [],
    tags: tagLinks.map((entry) => entry.tag.name),
    category: readCategoryName(listing.category),
    section: `Barang dari ${merchantName}`,
  }
}

/** The Explore and storefront grids show at most 20 cards per page. */
export const CATALOG_PAGE_SIZE = 20

export type CatalogRequest = Partial<CatalogQuery> & {
  type: CatalogType
  merchantId?: string
  limit?: number
}

function buildCatalogParams(query: CatalogRequest): URLSearchParams {
  const params = new URLSearchParams()

  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? CATALOG_PAGE_SIZE))

  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.category) params.set('category', query.category)
  if (query.minPrice !== null && query.minPrice !== undefined) {
    params.set('minPrice', String(query.minPrice))
  }
  if (query.maxPrice !== null && query.maxPrice !== undefined) {
    params.set('maxPrice', String(query.maxPrice))
  }
  if (query.sort && query.sort !== 'default') params.set('sort', query.sort)
  if (query.merchantId) params.set('merchantId', query.merchantId)

  return params
}

/**
 * GET /catalog/products or /catalog/services. Search, category, price, sort
 * and paging all happen on the server; this only maps the answer.
 */
export async function fetchCatalogPage(
  query: CatalogRequest,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  const path = query.type === 'service' ? '/catalog/services' : '/catalog/products'
  const response = await request<ApiListingPage>(`${path}?${buildCatalogParams(query)}`, {
    signal,
  })
  const rows = Array.isArray(response?.data) ? response.data : []
  const limit = response?.pagination?.limit ?? query.limit ?? CATALOG_PAGE_SIZE
  const total = response?.pagination?.total ?? rows.length

  return {
    items: rows.map((row) => toCatalogProduct(row, query.type)),
    pagination: {
      page: response?.pagination?.page ?? query.page ?? 1,
      limit,
      total,
      totalPages: response?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    },
  }
}

/**
 * Finds one listing for the detail page. The API has no single-item route yet,
 * so the newest listings of both catalogs are searched, and the curated mock
 * catalog answers for the mock ids the empty-catalog fallback still uses.
 */
export async function loadCatalogItem(id: string): Promise<CatalogProduct | null> {
  for (const type of ['product', 'service'] as const) {
    try {
      const { items } = await fetchCatalogPage({ type, limit: 50 })
      const found = items.find((entry) => entry.id === id)

      if (found) {
        return found
      }
    } catch {
      // Try the next catalog, then the mock list.
    }
  }

  return mockProducts.find((product) => product.id === id) ?? null
}
