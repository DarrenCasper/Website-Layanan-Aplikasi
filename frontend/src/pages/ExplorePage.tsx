import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import ProductCard from '../components/ProductCard'
import FilterPanel from '../components/FilterPanel'
import { SkeletonCards, SkeletonStatus } from '../components/CatalogSkeleton'
import {
  DEPARTMENT_SECTION,
  FTEIC_SECTION,
  loadCatalogProducts,
  type CatalogProduct,
  type CatalogSource,
} from '../lib/catalog'
import {
  DEFAULT_FILTERS,
  applyFilters,
  countActiveFilters,
  type CatalogFilters,
} from '../lib/catalogFilters'
import { CATALOG_TITLE, useDocumentTitle } from '../lib/useDocumentTitle'
import './ExplorePage.scss'

// Explore Page (Figma 25:2). The signed-in landing screen: a sticky bar, the
// filter column the design reserves on the left, and the two product sections
// stacked in one column to its right. Cards come from the API when it has
// listings and from the curated mock catalog otherwise, so the page always
// matches the design.
function ExplorePage() {
  const navigate = useNavigate()

  useDocumentTitle(CATALOG_TITLE)

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [source, setSource] = useState<CatalogSource>('mock')
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      const result = await loadCatalogProducts()

      if (!isActive) {
        return
      }

      setProducts(result.products)
      setSource(result.source)
      setIsLoading(false)
    }

    void load()

    return () => {
      isActive = false
    }
  }, [])

  const query = search.trim().toLowerCase()

  // Search runs first because it is driven from the navbar, then the panel's
  // filters and sort narrow and order whatever survived it. Keeping the two
  // stages separate is what lets the panel describe its own active count
  // without having to know about the search box.
  const matches = useMemo(() => {
    const searched =
      query === ''
        ? products
        : products.filter(
            (product) =>
              product.name.toLowerCase().includes(query) ||
              product.tags.some((tag) => tag.toLowerCase().includes(query)),
          )

    return applyFilters(searched, filters)
  }, [products, query, filters])

  const departmentProducts = matches.filter((product) => product.section !== FTEIC_SECTION)
  const fteicProducts = matches.filter((product) => product.section === FTEIC_SECTION)

  // The first heading is the design's department label, but live API data
  // carries its own group name, so the loaded section wins when there is one.
  const departmentHeading =
    products.find((product) => product.section !== FTEIC_SECTION)?.section ?? DEPARTMENT_SECTION

  // The mock catalog always carries an FTEIC section, so the heading is held
  // during loading and only dropped if the loaded list genuinely lacks one.
  const hasFteicSection = isLoading || products.some((product) => product.section === FTEIC_SECTION)

  const openProduct = useCallback(
    (id: string) => {
      navigate(`/product/${id}`)
    },
    [navigate],
  )

  const showNotice = !isLoading && source === 'mock' && products.length === 0

  const activeFilterCount = countActiveFilters(filters)
  const hasSearch = query !== ''

  // A section is only rendered when it has cards, so a heading never appears
  // above an empty grid.
  const hasDepartmentSection = isLoading || departmentProducts.length > 0
  const showFteicSection = hasFteicSection && (isLoading || fteicProducts.length > 0)

  // Nothing matched. The grid area says so and offers a way back rather than
  // leaving the page blank under two orphaned headings.
  const showEmptyState = !isLoading && matches.length === 0

  const clearEverything = () => {
    setFilters(DEFAULT_FILTERS)
    setSearch('')
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  return (
    <main className="explore">
      <NavBar searchValue={search} onSearchChange={setSearch} />

      {/* The design shows no page title, but a screen reader needs one heading to
          anchor the two section headings below, so it is present and hidden. */}
      <h1 className="explore__visually-hidden">Katalog barang Temu</h1>

      {isLoading ? <SkeletonStatus label="Memuat katalog barang" /> : null}

      <div className="explore__content">
        <FilterPanel
          products={products}
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
        />

        <div className="explore__items">
          {showEmptyState ? (
            <div className="explore__empty" role="status">
              <p className="explore__empty-title">Tidak ada barang yang cocok</p>

              <p className="explore__empty-text">
                {hasSearch && activeFilterCount > 0
                  ? 'Coba ubah kata kunci pencarian atau kurangi filter yang dipilih.'
                  : hasSearch
                    ? 'Coba kata kunci lain atau periksa ejaannya.'
                    : 'Coba lebarkan rentang harga atau kurangi filter yang dipilih.'}
              </p>

              <button className="explore__empty-action" type="button" onClick={clearEverything}>
                {hasSearch ? 'Hapus pencarian dan filter' : 'Reset filter'}
              </button>
            </div>
          ) : (
            <>
              {hasDepartmentSection ? (
                <div className="explore__section">
                  <h2 className="explore__heading">{departmentHeading}</h2>

                  {isLoading ? (
                    <div className="explore__grid" aria-busy="true">
                      <SkeletonCards />
                    </div>
                  ) : (
                    <div className="explore__grid">
                      {departmentProducts.map((product) => (
                        <ProductCard key={product.id} product={product} onClick={openProduct} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showFteicSection ? (
                <div className="explore__section">
                  <h2 className="explore__heading">{FTEIC_SECTION}</h2>

                  {isLoading ? (
                    <div className="explore__grid" aria-busy="true">
                      <SkeletonCards />
                    </div>
                  ) : (
                    <div className="explore__grid">
                      {fteicProducts.map((product) => (
                        <ProductCard key={product.id} product={product} onClick={openProduct} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showNotice ? (
        <p className="explore__notice">
          Katalog contoh ditampilkan karena belum ada barang dari penjual.
        </p>
      ) : null}
    </main>
  )
}

export default ExplorePage
