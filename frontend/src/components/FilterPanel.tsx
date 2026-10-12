import { useMemo, useState } from 'react'
import { formatRupiah, type CatalogProduct } from '../lib/catalog'
import {
  countActiveFilters,
  formatPriceInput,
  isPriceRangeInvalid,
  parsePriceInput,
  type CatalogFilters,
  type CatalogSort,
} from '../lib/catalogFilters'
import './FilterPanel.scss'

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'terbaru', label: 'Terbaru' },
  { value: 'termurah', label: 'Termurah' },
  { value: 'termahal', label: 'Termahal' },
  { value: 'terlaris', label: 'Terlaris' },
]

// Tags are generated from the catalog, which can carry a long tail. Ten keeps
// the panel a comfortable height before the "show all" toggle is needed.
const VISIBLE_TAG_COUNT = 10

type FilterPanelProps = {
  products: CatalogProduct[]
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
  onReset: () => void
}

// The filter column the Explore frame reserves on the left. The design left it
// as an empty panel; it now carries the category, price and sort controls, and
// collapses behind a toggle once the layout drops to one column.
function FilterPanel({ products, filters, onChange, onReset }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)

  // Tags are collected from whatever the catalog actually contains, so live API
  // listings produce their own category list instead of a hardcoded one. The
  // most common tags come first, which puts the useful ones above the fold.
  const tags = useMemo(() => {
    const counts = new Map<string, number>()

    for (const product of products) {
      for (const tag of product.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
  }, [products])

  // The catalog's own bounds, shown as a hint under the price fields.
  const priceBounds = useMemo(() => {
    if (products.length === 0) {
      return null
    }

    const prices = products.map((product) => product.price)

    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [products])

  const visibleTags = showAllTags ? tags : tags.slice(0, VISIBLE_TAG_COUNT)
  const hiddenTagCount = tags.length - visibleTags.length
  const activeCount = countActiveFilters(filters)
  const priceInvalid = isPriceRangeInvalid(filters)

  const toggleTag = (tag: string) => {
    const nextTags = filters.tags.includes(tag)
      ? filters.tags.filter((entry) => entry !== tag)
      : [...filters.tags, tag]

    onChange({ ...filters, tags: nextTags })
  }

  const handlePriceChange = (field: 'minPrice' | 'maxPrice', raw: string) => {
    onChange({ ...filters, [field]: parsePriceInput(raw) })
  }

  const handleReset = () => {
    onReset()
    setShowAllTags(false)
  }

  return (
    <div className="explore__filter">
      <button
        className="filter-panel__toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="filter-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Filter</span>
        {activeCount > 0 ? <span className="filter-panel__toggle-count">{activeCount}</span> : null}
      </button>

      <div
        className={isOpen ? 'filter-panel filter-panel--open' : 'filter-panel'}
        id="filter-panel"
      >
        <div className="filter-panel__head">
          <h2 className="filter-panel__title">Filter</h2>

          {activeCount > 0 ? (
            <button className="filter-panel__reset" type="button" onClick={handleReset}>
              Reset filter
            </button>
          ) : null}
        </div>

        <p className="filter-panel__summary">
          {activeCount > 0 ? `${activeCount} filter aktif` : 'Belum ada filter yang dipilih'}
        </p>

        <div className="filter-panel__group">
          <h3 className="filter-panel__group-title">Kategori</h3>

          {tags.length > 0 ? (
            <>
              <div className="filter-panel__chips">
                {visibleTags.map((tag) => {
                  const isSelected = filters.tags.includes(tag)

                  return (
                    <button
                      className={isSelected ? 'filter-chip filter-chip--selected' : 'filter-chip'}
                      key={tag}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              {hiddenTagCount > 0 || showAllTags ? (
                <button
                  className="filter-panel__more"
                  type="button"
                  aria-expanded={showAllTags}
                  onClick={() => setShowAllTags((shown) => !shown)}
                >
                  {showAllTags ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${tags.length})`}
                </button>
              ) : null}
            </>
          ) : (
            <p className="filter-panel__empty">Belum ada kategori</p>
          )}
        </div>

        <div className="filter-panel__group">
          <h3 className="filter-panel__group-title">Rentang Harga</h3>

          <div className="filter-panel__price-row">
            <label className="filter-panel__price-field">
              <span className="filter-panel__price-label">Minimum</span>
              <span className="filter-panel__price-input-wrap">
                <span className="filter-panel__price-prefix">Rp</span>
                <input
                  className="filter-panel__price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatPriceInput(filters.minPrice)}
                  onChange={(event) => handlePriceChange('minPrice', event.target.value)}
                />
              </span>
            </label>

            <label className="filter-panel__price-field">
              <span className="filter-panel__price-label">Maksimum</span>
              <span className="filter-panel__price-input-wrap">
                <span className="filter-panel__price-prefix">Rp</span>
                <input
                  className="filter-panel__price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatPriceInput(filters.maxPrice)}
                  onChange={(event) => handlePriceChange('maxPrice', event.target.value)}
                />
              </span>
            </label>
          </div>

          {priceInvalid ? (
            <p className="filter-panel__error" role="alert">
              Harga minimum tidak boleh melebihi maksimum.
            </p>
          ) : priceBounds ? (
            <p className="filter-panel__hint">
              {formatRupiah(priceBounds.min)} sampai {formatRupiah(priceBounds.max)}
            </p>
          ) : null}
        </div>

        <div className="filter-panel__group">
          <h3 className="filter-panel__group-title">Urutkan</h3>

          <div className="filter-panel__sorts">
            {SORT_OPTIONS.map((option) => {
              const isSelected = filters.sort === option.value

              return (
                <button
                  className={isSelected ? 'filter-sort filter-sort--selected' : 'filter-sort'}
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange({ ...filters, sort: option.value })}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
