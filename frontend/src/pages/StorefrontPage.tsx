import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import FilterPanel from '../components/FilterPanel'
import CatalogResults from '../components/CatalogResults'
import { useChat } from '../context/chatContext'
import { useAuth } from '../context/authContext'
import { isAbortError, toErrorMessage } from '../lib/api'
import { findCategory } from '../lib/categories'
import {
  DEFAULT_FILTERS,
  queryFromSearchParams,
  queryToSearchParams,
  type CatalogFilters,
  type CatalogQuery,
} from '../lib/catalogFilters'
import {
  MerchantNotFoundError,
  fetchPublicMerchant,
  initialsOf,
  type MerchantProfile,
} from '../lib/merchants'
import { useCatalogPage, useDebouncedValue } from '../lib/useCatalogPage'
import { useCategories } from '../lib/useCategories'
import { CATALOG_BRAND, CATALOG_TITLE, useDocumentTitle } from '../lib/useDocumentTitle'
import chevronIcon from '../assets/icons/chevron-crumb.svg'
import chatIcon from '../assets/icons/chat-white.svg'
import searchIcon from '../assets/icons/search-store.svg'
import storeIcon from '../assets/icons/store.svg'
import './StorefrontPage.scss'

const SEARCH_DEBOUNCE_MS = 300

type MerchantState =
  | { status: 'loading' }
  | { status: 'ready'; merchant: MerchantProfile }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

// Public storefront at /merchant/:merchantId (Figma #38 97:9561). The header
// comes from the store profile; the Produk/Jasa tabs list only this store's
// catalog with the same search, category filter and paging as Explore.
function StorefrontPage() {
  const { merchantId = '' } = useParams<{ merchantId: string }>()
  const [merchantState, setMerchantState] = useState<MerchantState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchPublicMerchant(merchantId, controller.signal).then(
      (merchant) => setMerchantState({ status: 'ready', merchant }),
      (error: unknown) => {
        if (isAbortError(error)) return
        setMerchantState(
          error instanceof MerchantNotFoundError
            ? { status: 'not-found' }
            : { status: 'error', message: toErrorMessage(error) },
        )
      },
    )

    return () => controller.abort()
  }, [merchantId, attempt])

  const title =
    merchantState.status === 'ready'
      ? `${merchantState.merchant.namaToko} · ${CATALOG_BRAND}`
      : merchantState.status === 'not-found'
        ? `Toko tidak ditemukan · ${CATALOG_BRAND}`
        : CATALOG_TITLE
  useDocumentTitle(title)

  return (
    <main className="store">
      <NavBar />

      {merchantState.status === 'not-found' ? <StoreNotFound /> : null}

      {merchantState.status === 'error' ? (
        <div className="store-missing" role="alert">
          <h1 className="store-missing__title">Toko gagal dimuat</h1>
          <p className="store-missing__text">{merchantState.message}</p>
          <button
            className="store-missing__action"
            type="button"
            onClick={() => {
              setMerchantState({ status: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {merchantState.status === 'loading' ? (
        <div className="store__inner" aria-busy="true">
          <div className="store-header store-header--skeleton" />
        </div>
      ) : null}

      {merchantState.status === 'ready' ? (
        <StoreBody key={merchantId} merchant={merchantState.merchant} />
      ) : null}
    </main>
  )
}

function StoreBody({ merchant }: { merchant: MerchantProfile }) {
  const { openMerchantChat } = useChat()
  const { user } = useAuth()
  const categories = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => queryFromSearchParams(searchParams), [searchParams])

  const [searchInput, setSearchInput] = useState(query.q)
  const [syncedQ, setSyncedQ] = useState(query.q)

  if (syncedQ !== query.q) {
    setSyncedQ(query.q)
    setSearchInput(query.q)
  }

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)

  const navigateTo = useCallback(
    (next: CatalogQuery, replace = false) =>
      setSearchParams(queryToSearchParams(next), { replace }),
    [setSearchParams],
  )

  useEffect(() => {
    if (debouncedSearch.trim() !== query.q.trim()) {
      navigateTo({ ...query, q: debouncedSearch.trim(), page: 1 }, true)
    }
    // Only a settled keystroke should navigate; `query` changing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { state, retry } = useCatalogPage({ ...query, merchantId: merchant.id })

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

  const page = state.page
  const total = page?.pagination.total ?? null
  const category = findCategory(categories, query.category)
  const noun = query.type === 'service' ? 'jasa' : 'barang'
  const isOwnStore = merchant.members.some((member) => member.userId === user?.id)

  const priceBounds = useMemo(() => {
    if (!page || page.items.length === 0) return null
    const prices = page.items.map((item) => item.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [page])

  const countLine =
    total === null
      ? null
      : `${total.toLocaleString('id-ID')} ${noun}${category ? ` di ${category.name}` : ''}`

  return (
    <div className="store__inner">
      <nav className="store-crumbs" aria-label="Breadcrumb">
        <Link to="/">Explore</Link>
        <img src={chevronIcon} alt="" width={14} height={14} />
        <span aria-current="page">{merchant.namaToko}</span>
      </nav>

      <header className="store-header">
        <span className="store-header__avatar" aria-hidden="true">
          {initialsOf(merchant.namaToko)}
        </span>

        <div className="store-header__text">
          <h1 className="store-header__name">{merchant.namaToko}</h1>
          {merchant.deskripsi ? <p className="store-header__desc">{merchant.deskripsi}</p> : null}
          <p className="store-header__counts">
            <span>
              <strong>{merchant.productCount.toLocaleString('id-ID')}</strong> produk
            </span>
            <span>
              <strong>{merchant.serviceCount.toLocaleString('id-ID')}</strong> jasa
            </span>
          </p>
        </div>

        {isOwnStore ? (
          <Link className="store-header__chat" to={`/toko-saya/${merchant.id}`}>
            Kelola toko
          </Link>
        ) : (
          <button
            className="store-header__chat"
            type="button"
            onClick={() => openMerchantChat(merchant.id, merchant.namaToko)}
          >
            <img src={chatIcon} alt="" width={18} height={18} />
            Chat penjual
          </button>
        )}
      </header>

      <div className="store-tabs" role="tablist" aria-label="Katalog toko">
        {(
          [
            ['product', `Produk (${merchant.productCount})`],
            ['service', `Jasa (${merchant.serviceCount})`],
          ] as const
        ).map(([type, label]) => (
          <button
            className={query.type === type ? 'store-tab store-tab--on' : 'store-tab'}
            type="button"
            role="tab"
            aria-selected={query.type === type}
            key={type}
            onClick={() => navigateTo({ ...query, type, category: null, page: 1 })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="store__catalog">
        <FilterPanel
          categories={categories}
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleReset}
          showTypeToggle={false}
          priceBounds={priceBounds}
          resultCount={total}
          resultNoun={noun}
        />

        <section className="store__results" aria-label={`Katalog ${merchant.namaToko}`}>
          <label className="store-search">
            <img src={searchIcon} alt="" width={18} height={18} />
            <input
              type="search"
              aria-label={`Cari di ${merchant.namaToko}`}
              placeholder={`Cari di ${merchant.namaToko}`}
              value={searchInput}
              maxLength={100}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          {countLine ? (
            <p className="store__count" aria-live="polite">
              {countLine}
            </p>
          ) : null}

          <CatalogResults
            state={state}
            onRetry={retry}
            onPageChange={(next) => {
              navigateTo({ ...query, page: next })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onClearAll={() => {
              setSearchInput('')
              navigateTo({ ...query, ...DEFAULT_FILTERS, type: query.type, q: '', page: 1 })
            }}
            emptyTitle={`Belum ada ${noun} yang cocok di toko ini`}
          />
        </section>
      </div>
    </div>
  )
}

// "Toko tidak ditemukan" (Figma 97:9798): unknown, pending or suspended store.
function StoreNotFound() {
  return (
    <div className="store-missing">
      <span className="store-missing__icon" aria-hidden="true">
        <img src={storeIcon} alt="" width={34} height={34} />
      </span>
      <h1 className="store-missing__title">Toko tidak ditemukan</h1>
      <p className="store-missing__text">
        Toko ini tidak ada atau sedang ditangguhkan. Coba cari barangnya langsung di Explore.
      </p>
      <Link className="store-missing__action" to="/">
        Kembali ke Explore
      </Link>
    </div>
  )
}

export default StorefrontPage
