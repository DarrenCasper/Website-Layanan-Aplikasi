import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { categoriesFor, type Category } from '../lib/categories'
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  countActiveFilters,
  formatPriceInput,
  formatPriceShort,
  parsePriceInput,
  type CatalogFilters,
} from '../lib/catalogFilters'
import alertIcon from '../assets/icons/alert.svg'
import closeIcon from '../assets/icons/x.svg'
import filterIcon from '../assets/icons/filter.svg'
import './FilterPanel.scss'

// Price fields commit after a short pause so typing "1000000" sends one
// request, not seven.
const PRICE_COMMIT_DELAY_MS = 400

type FilterPanelProps = {
  categories: Category[]
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
  onReset: () => void
  /** Hides the Produk/Jasa toggle where the page has its own tabs. */
  showTypeToggle?: boolean
  /** The loaded catalog's price span, shown under the price fields. */
  priceBounds?: { min: number; max: number } | null
  /** Result count for the collapsed toggle row and the sheet's apply button. */
  resultCount?: number | null
  /** Noun for the count, e.g. "barang". */
  resultNoun?: string
}

type PriceDraft = { min: string; max: string }

function draftFrom(filters: CatalogFilters): PriceDraft {
  return { min: formatPriceInput(filters.minPrice), max: formatPriceInput(filters.maxPrice) }
}

// Filter panel (Figma #34, 97:5590). A white card beside the grid on desktop; at
// tablet width and below it collapses to a "Filter" pill that opens the same
// card as a full screen sheet (97:5766 closed, 97:5834 open).
function FilterPanel({
  categories,
  filters,
  onChange,
  onReset,
  showTypeToggle = true,
  priceBounds = null,
  resultCount = null,
  resultNoun = 'barang',
}: FilterPanelProps) {
  const headingId = useId()
  const priceErrorId = useId()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // The price fields keep their own text so a half-typed amount is not pushed
  // to the URL. When the committed values change from outside (Reset, a chip's
  // remove button, the back button) the drafts follow, compared during render
  // rather than in an effect so there is no flash of stale text.
  const [priceDraft, setPriceDraft] = useState<PriceDraft>(() => draftFrom(filters))
  const [committedPrice, setCommittedPrice] = useState({
    min: filters.minPrice,
    max: filters.maxPrice,
  })

  if (committedPrice.min !== filters.minPrice || committedPrice.max !== filters.maxPrice) {
    setCommittedPrice({ min: filters.minPrice, max: filters.maxPrice })
    setPriceDraft(draftFrom(filters))
  }

  const draftMin = parsePriceInput(priceDraft.min)
  const draftMax = parsePriceInput(priceDraft.max)
  const draftInvalid = draftMin !== null && draftMax !== null && draftMin > draftMax
  const draftDiffers = draftMin !== filters.minPrice || draftMax !== filters.maxPrice

  // Commit a valid draft after a pause. An invalid range stays local and shows
  // the error instead of being sent to a server that would reject it.
  useEffect(() => {
    if (draftInvalid || !draftDiffers) {
      return
    }

    const timer = window.setTimeout(() => {
      onChange({ ...filters, minPrice: draftMin, maxPrice: draftMax })
    }, PRICE_COMMIT_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [draftInvalid, draftDiffers, draftMin, draftMax, filters, onChange])

  // The sheet is modal: Escape closes it, the page behind stops scrolling, and
  // focus moves in on open and back to the pill on close.
  useEffect(() => {
    if (!isSheetOpen) {
      return
    }

    const toggle = toggleRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSheetOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      toggle?.focus()
    }
  }, [isSheetOpen])

  const activeCount = countActiveFilters({
    ...filters,
    minPrice: draftMin,
    maxPrice: draftMax,
  })
  const visibleCategories = categoriesFor(categories, filters.type)
  const specific = visibleCategories.filter((entry) => entry.kind === 'specific')
  const fallback = visibleCategories.filter((entry) => entry.kind === 'fallback')

  const handleTypeChange = (type: CatalogFilters['type']) => {
    if (type === filters.type) {
      return
    }

    // Categories belong to one catalog, so switching drops the chosen one.
    onChange({ ...filters, type, category: null })
  }

  const handleReset = () => {
    setPriceDraft({ min: '', max: '' })
    onReset()
  }

  const handlePriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !draftInvalid && draftDiffers) {
      onChange({ ...filters, minPrice: draftMin, maxPrice: draftMax })
    }
  }

  const countLabel =
    resultCount === null ? null : `${resultCount.toLocaleString('id-ID')} ${resultNoun}`

  const renderRadio = (
    name: string,
    value: string,
    label: string,
    checked: boolean,
    onSelect: () => void,
    badge?: string,
  ) => (
    <label className={checked ? 'fp-radio fp-radio--checked' : 'fp-radio'} key={value}>
      <input
        className="fp-radio__input"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
      />
      <span className="fp-radio__dot" aria-hidden="true" />
      <span className="fp-radio__label">{label}</span>
      {badge ? <span className="fp-badge">{badge}</span> : null}
    </label>
  )

  return (
    <div className="filter">
      <div className="filter__bar">
        <button
          className="filter__toggle"
          type="button"
          ref={toggleRef}
          aria-expanded={isSheetOpen}
          aria-controls={`${headingId}-panel`}
          onClick={() => setIsSheetOpen(true)}
        >
          <img src={filterIcon} alt="" width={16} height={16} />
          <span>Filter</span>
          {activeCount > 0 ? (
            <span className="filter__toggle-count" aria-label={`${activeCount} filter aktif`}>
              {activeCount}
            </span>
          ) : null}
        </button>

        {countLabel ? <p className="filter__bar-count">{countLabel}</p> : null}
      </div>

      {isSheetOpen ? (
        <div className="filter__scrim" aria-hidden="true" onClick={() => setIsSheetOpen(false)} />
      ) : null}

      <div
        className={isSheetOpen ? 'filter-panel filter-panel--open' : 'filter-panel'}
        id={`${headingId}-panel`}
        ref={sheetRef}
        tabIndex={-1}
        role={isSheetOpen ? 'dialog' : 'region'}
        aria-modal={isSheetOpen ? true : undefined}
        aria-labelledby={headingId}
      >
        <div className="filter-panel__head">
          <div className="filter-panel__head-row">
            <h2 className="filter-panel__title" id={headingId}>
              Filter
            </h2>

            {activeCount > 0 || filters.sort !== DEFAULT_FILTERS.sort ? (
              <button className="filter-panel__reset" type="button" onClick={handleReset}>
                Reset filter
              </button>
            ) : null}

            <button
              className="filter-panel__close"
              type="button"
              aria-label="Tutup filter"
              onClick={() => setIsSheetOpen(false)}
            >
              <img src={closeIcon} alt="" width={22} height={22} />
            </button>
          </div>

          <p className="filter-panel__summary" aria-live="polite">
            {activeCount > 0 ? `${activeCount} filter aktif` : 'Belum ada filter aktif'}
          </p>
        </div>

        {showTypeToggle ? (
          <fieldset className="fp-segment">
            <legend className="fp-visually-hidden">Jenis katalog</legend>
            {(
              [
                ['product', 'Produk'],
                ['service', 'Jasa'],
              ] as const
            ).map(([value, label]) => (
              <label
                className={
                  filters.type === value
                    ? 'fp-segment__item fp-segment__item--on'
                    : 'fp-segment__item'
                }
                key={value}
              >
                <input
                  className="fp-segment__input"
                  type="radio"
                  name={`${headingId}-type`}
                  value={value}
                  checked={filters.type === value}
                  onChange={() => handleTypeChange(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <fieldset className="fp-group">
          <legend className="fp-group__head">
            <span className="fp-group__title">Kategori</span>
            <span className="fp-group__hint">Pilih satu</span>
          </legend>

          <div className="fp-options">
            {renderRadio(
              `${headingId}-category`,
              '',
              'Semua kategori',
              filters.category === null,
              () => onChange({ ...filters, category: null }),
            )}

            {specific.length > 0 ? (
              <p className="fp-section" aria-hidden="true">
                Kategori spesifik
              </p>
            ) : null}

            {specific.map((category) =>
              renderRadio(
                `${headingId}-category`,
                category.slug,
                category.name,
                filters.category === category.slug,
                () => onChange({ ...filters, category: category.slug }),
              ),
            )}

            {fallback.length > 0 ? (
              <div className="fp-section" aria-hidden="true">
                <p className="fp-section__title">Kategori umum</p>
                <p className="fp-section__note">Dipakai kalau tidak ada yang cocok</p>
              </div>
            ) : null}

            {fallback.map((category) =>
              renderRadio(
                `${headingId}-category`,
                category.slug,
                category.name,
                filters.category === category.slug,
                () => onChange({ ...filters, category: category.slug }),
                'Umum',
              ),
            )}
          </div>
        </fieldset>

        <hr className="fp-divider" />

        <fieldset className="fp-group fp-group--price">
          <legend className="fp-group__head">
            <span className="fp-group__title">Rentang harga</span>
          </legend>

          <div className="fp-price-row">
            {(
              [
                ['min', 'Min', 'Harga minimum'],
                ['max', 'Maks', 'Harga maksimum'],
              ] as const
            ).map(([field, placeholder, label]) => (
              <label
                className={draftInvalid ? 'fp-price fp-price--invalid' : 'fp-price'}
                key={field}
              >
                <span className="fp-price__prefix" aria-hidden="true">
                  Rp
                </span>
                <input
                  className="fp-price__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={label}
                  aria-invalid={draftInvalid}
                  aria-describedby={draftInvalid ? priceErrorId : undefined}
                  placeholder={placeholder}
                  value={priceDraft[field]}
                  onChange={(event) => {
                    const parsed = parsePriceInput(event.target.value)
                    setPriceDraft((draft) => ({ ...draft, [field]: formatPriceInput(parsed) }))
                  }}
                  onKeyDown={handlePriceKeyDown}
                />
              </label>
            ))}
          </div>

          {draftInvalid ? (
            <p className="fp-error" id={priceErrorId} role="alert">
              <img src={alertIcon} alt="" width={14} height={14} />
              Harga minimum melebihi maksimum
            </p>
          ) : priceBounds ? (
            <p className="fp-hint">
              Di katalog: {formatPriceShort(priceBounds.min)} sampai{' '}
              {formatPriceShort(priceBounds.max)}
            </p>
          ) : null}
        </fieldset>

        <hr className="fp-divider" />

        <fieldset className="fp-group">
          <legend className="fp-group__head">
            <span className="fp-group__title">Urutkan</span>
          </legend>

          <div className="fp-options">
            {SORT_OPTIONS.map((option) =>
              renderRadio(
                `${headingId}-sort`,
                option.value,
                option.label,
                filters.sort === option.value,
                () => onChange({ ...filters, sort: option.value }),
              ),
            )}
          </div>
        </fieldset>

        <div className="filter-panel__footer">
          <button
            className="filter-panel__apply"
            type="button"
            onClick={() => setIsSheetOpen(false)}
          >
            {resultCount === null
              ? 'Tampilkan hasil'
              : `Tampilkan ${resultCount.toLocaleString('id-ID')} hasil`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
