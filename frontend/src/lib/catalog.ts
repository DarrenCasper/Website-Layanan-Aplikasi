// Catalog data layer shared by the Explore page and the Product Description page.
//
// The backend's Product model only carries name, price, stock, description and
// tags, so the artwork, rating, sold count and variants the designs show are
// filled in locally: images come from the Figma asset pool and the numeric
// extras are derived deterministically from the product id. When the API has
// nothing to return the curated mock catalog takes over, which keeps both
// screens faithful to the design even before any merchant has listed an item.

import { request } from './api'
import { mockProducts, productImages } from './mockCatalog'

// The Explore page groups cards by section, so the two headings the mock
// catalog uses are re-exported here and the page imports everything catalog
// related from one module.
export { DEPARTMENT_SECTION, FTEIC_SECTION } from './mockCatalog'

export type CatalogProduct = {
  id: string
  name: string
  price: number
  image: string
  rating: number
  sold: number
  stock: number
  description: string
  merchantName: string
  merchantCity: string
  variants: string[]
  tags: string[]
  section: string
}

export type CatalogSource = 'api' | 'mock'

export type CatalogLoadResult = {
  products: CatalogProduct[]
  source: CatalogSource
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

type ApiProductTag = {
  tag: { name: string }
}

type ApiProduct = {
  id: string
  name: string
  price: number
  stock: number
  description: string | null
  merchant: { namaToko: string }
  productTags: ApiProductTag[]
}

type ApiProductList = {
  data: ApiProduct[]
}

function toCatalogProduct(product: ApiProduct): CatalogProduct {
  const seed = hashId(product.id)
  const merchantName = product.merchant?.namaToko ?? 'Toko Layap'

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    image: productImages[seed % productImages.length],
    // 3.0 - 5.0, one decimal, matching the range the design cards show.
    rating: Number((3 + (seed % 21) / 10).toFixed(1)),
    sold: seed % 120,
    stock: product.stock,
    description:
      product.description?.trim() ||
      `Dijual oleh ${merchantName}. Silakan hubungi penjual untuk informasi lebih lanjut.`,
    merchantName,
    merchantCity: 'Kota Surabaya',
    variants: [],
    tags: product.productTags.map((entry) => entry.tag.name),
    section: `Barang dari ${merchantName}`,
  }
}

/** GET /catalog/products, mapped onto the shape the two catalog screens need. */
export async function fetchCatalogProducts(): Promise<CatalogProduct[]> {
  const response = await request<ApiProductList>('/catalog/products?limit=50')

  if (!Array.isArray(response?.data)) {
    return []
  }

  return response.data.map(toCatalogProduct)
}

/**
 * Loads the catalog, preferring live API data and falling back to the curated
 * mock list when the API is unreachable or has not listed anything yet.
 */
export async function loadCatalogProducts(): Promise<CatalogLoadResult> {
  try {
    const products = await fetchCatalogProducts()

    if (products.length > 0) {
      return { products, source: 'api' }
    }
  } catch {
    // A transport failure or a non-2xx answer simply means "use the mock list".
  }

  return { products: mockProducts, source: 'mock' }
}
