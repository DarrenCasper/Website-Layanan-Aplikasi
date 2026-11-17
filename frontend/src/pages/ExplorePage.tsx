import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import FilterPanel from '../components/FilterPanel'
import CatalogResults from '../components/CatalogResults'
import { findCategory } from '../lib/categories'
import {
  DEFAULT_FILTERS,
  DEFAULT_QUERY,
  formatPriceRange,
  queryFromSearchParams,
  queryToSearchParams,
  type CatalogFilters,
  type CatalogQuery,
} from '../lib/catalogFilters'
import { useCatalogPage, useDebouncedValue } from '../lib/useCatalogPage'
import { useCategories } from '../lib/useCategories'
import { CATALOG_TITLE, useDocumentTitle } from '../lib/useDocumentTitle'
import chipCloseIcon from '../assets/icons/x-small.svg'
import './ExplorePage.scss'

// The search box waits this long after the last keystroke before searching,
// so typing a 10 character query sends at most a couple of requests.
const SEARCH_DEBOUNCE_MS = 300

// Explore page (Figma #34 97:5577). Search text, category, price, sort, the
// product/service toggle and the page all live in the URL and are sent to
// GET /catalog/products or /catalog/services; nothing is filtered locally.
function ExplorePage() {
  useDocumentTitle(CATALOG_TITLE)

  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => queryFromSearchParams(searchParams), [searchParams])
  const categories = useCategories()
  const location = useLocation()
  const routerNavigate = useNavigate()

  // A one-off message from another page, e.g. a dashboard the user has no
  // access to. It is read once and dropped from history so a refresh does not
  // show it again.
  const [toast, setToast] = useState<string | null>(() => {
    const value = (location.state as { toast?: unknown } | null)?.toast
    return typeof value === 'string' ? value : null
  })

  useEffect(() => {
    if ((location.state as { toast?: unknown } | null)?.toast) {
      routerNavigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    }
  }, [location, routerNavigate])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  // The navbar field is edited locally and debounced into the URL. When the URL
  // changes on its own (back button, a chip, Reset) the field follows it.
  const [searchInput, setSearchInput] = useState(query.q)
  const [syncedQ, setSyncedQ] = useState(query.q)

  if (syncedQ !== query.q) {
    setSyncedQ(query.q)
    setSearchInput(query.q)
  }

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)

  const navigateTo = useCallback(
    (next: CatalogQuery, replace = false) => {
      setSearchParams(queryToSearchParams(next), { replace })
    },
    [setSearchParams],
  )

  useEffect(() => {
    const trimmed = debouncedSearch.trim()

    if (trimmed !== query.q.trim()) {
      // Typing refines one search, so it replaces the entry instead of filling
      // the history with every intermediate word.
      navigateTo({ ...query, q: trimmed, page: 1 }, true)
    }
    // Only a settled keystroke should navigate; `query` changing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { state, retry } = useCatalogPage({ ...query })

  const filters: CatalogFilters = {
    type: query.type,
    category: query.category,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
  }

  const handleFiltersChange = useCallback(
    (next: CatalogFilters) => navigateTo({ ...query, ...next, page: 1 }),
    [navigateTo, query],
  )

  const handleReset = useCallback(
    () => navigateTo({ ...query, ...DEFAULT_FILTERS, type: query.type, page: 1 }),
    [navigateTo, query],
  )

  const clearEverything = () => {
    setSearchInput('')
    navigateTo({ ...DEFAULT_QUERY, type: query.type })
  }

  const handlePageChange = (page: number) => {
    navigateTo({ ...query, page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const page = state.page
  const total = page?.pagination.total ?? null
  const noun = query.type === 'service' ? 'jasa' : 'barang'
  const category = findCategory(categories, query.category)

  const priceBounds = useMemo(() => {
    if (!page || page.items.length === 0) {
      return null
    }

    const prices = page.items.map((item) => item.price)

    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [page])

  const heading = query.q
    ? `Hasil untuk “${query.q}”`
    : (category?.name ?? (query.type === 'service' ? 'Semua jasa' : 'Semua produk'))

  const chips: { key: string; label: string; onRemove: () => void }[] = []

  if (query.q) {
    chips.push({
      key: 'q',
      label: `“${query.q}”`,
      onRemove: () => navigateTo({ ...query, q: '', page: 1 }),
    })
  }

  if (category) {
    chips.push({
      key: 'category',
      label: category.name,
      onRemove: () => navigateTo({ ...query, category: null, page: 1 }),
    })
  }

  if (query.minPrice !== null || query.maxPrice !== null) {
    chips.push({
      key: 'price',
      label: formatPriceRange(query.minPrice, query.maxPrice),
      onRemove: () => navigateTo({ ...query, minPrice: null, maxPrice: null, page: 1 }),
    })
  }

  return (
    <main className="explore">
      <NavBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={() => navigateTo({ ...query, q: searchInput.trim(), page: 1 }, true)}
      />

      {toast ? (
        <div className="explore__toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Tutup pesan" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      ) : null}

      <div className="explore__content">
        <FilterPanel
          categories={categories}
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleReset}
          priceBounds={priceBounds}
          resultCount={total}
          resultNoun={noun}
        />

        <section className="explore__results" aria-labelledby="explore-heading">
          <div className="explore__head">
            <div className="explore__head-row">
              <h1 className="explore__heading" id="explore-heading">
                {heading}
              </h1>

              {total !== null ? (
                <p className="explore__count" aria-live="polite">
                  {total.toLocaleString('id-ID')} {noun}
                </p>
              ) : null}
            </div>

            {chips.length > 0 ? (
              <ul className="explore__chips" aria-label="Filter aktif">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      className="explore__chip"
                      type="button"
                      aria-label={`Hapus filter ${chip.label}`}
                      onClick={chip.onRemove}
                    >
                      <span>{chip.label}</span>
                      <img src={chipCloseIcon} alt="" width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <CatalogResults
            state={state}
            onRetry={retry}
            onPageChange={handlePageChange}
            onClearAll={clearEverything}
            emptyTitle={`Tidak ada ${noun} yang cocok`}
          />
        </section>
      </div>
    </main>
  )
}

export default ExplorePage
