import { useNavigate } from 'react-router-dom'
import ProductCard from './ProductCard'
import Pagination from './Pagination'
import { SkeletonCards } from './CatalogSkeleton'
import type { CatalogPageState } from '../lib/useCatalogPage'
import alertIcon from '../assets/icons/alert-large.svg'
import retryIcon from '../assets/icons/retry.svg'
import './CatalogResults.scss'

type CatalogResultsProps = {
  state: CatalogPageState
  onRetry: () => void
  onPageChange: (page: number) => void
  /** Shown in the empty state; resets search and filters. */
  onClearAll: () => void
  emptyTitle?: string
  emptyText?: string
  clearLabel?: string
}

// The grid half of the catalog screens: the white card of ProductCards from the
// Explore and storefront frames (Figma 97:5677, 97:9681), plus the states the
// frames leave implicit. Loading keeps the previous cards dimmed when there are
// some, so paging does not flash the layout; the first load shows skeletons.
function CatalogResults({
  state,
  onRetry,
  onPageChange,
  onClearAll,
  emptyTitle = 'Tidak ada hasil yang cocok',
  emptyText = 'Coba kata kunci lain, pilih kategori lain, atau lebarkan rentang harga.',
  clearLabel = 'Reset pencarian dan filter',
}: CatalogResultsProps) {
  const navigate = useNavigate()
  const page = state.page
  const isLoading = state.status === 'loading'

  if (state.status === 'error' && !page) {
    return (
      <div className="results-state" role="alert">
        <span className="results-state__icon results-state__icon--danger" aria-hidden="true">
          <img src={alertIcon} alt="" width={28} height={28} />
        </span>
        <p className="results-state__title">Katalog gagal dimuat</p>
        <p className="results-state__text">{state.message}</p>
        <button className="results-state__action" type="button" onClick={onRetry}>
          <img src={retryIcon} alt="" width={16} height={16} />
          Coba lagi
        </button>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="results-grid" aria-busy="true">
        <SkeletonCards count={8} />
      </div>
    )
  }

  if (page.items.length === 0 && !isLoading) {
    return (
      <div className="results-state" role="status">
        <p className="results-state__title">{emptyTitle}</p>
        <p className="results-state__text">{emptyText}</p>
        <button className="results-state__action" type="button" onClick={onClearAll}>
          {clearLabel}
        </button>
      </div>
    )
  }

  return (
    <>
      {state.status === 'error' ? (
        <div className="results-banner" role="alert">
          <span>{state.message}</span>
          <button type="button" onClick={onRetry}>
            Coba lagi
          </button>
        </div>
      ) : null}

      <div
        className={isLoading ? 'results-grid results-grid--stale' : 'results-grid'}
        aria-busy={isLoading}
      >
        {page.items.map((item) => (
          <ProductCard key={item.id} product={item} onClick={(id) => navigate(`/product/${id}`)} />
        ))}
      </div>

      <Pagination
        page={page.pagination.page}
        totalPages={page.pagination.totalPages}
        onChange={onPageChange}
      />
    </>
  )
}

export default CatalogResults
