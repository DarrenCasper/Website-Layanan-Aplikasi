import pagePrevIcon from '../assets/icons/page-prev.svg'
import pageNextIcon from '../assets/icons/page-next.svg'
import './Pagination.scss'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (page: number) => void
  label?: string
}

// How many numbered buttons sit either side of the current page before the
// run is shortened with an ellipsis.
const SIBLINGS = 1

function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 5 + SIBLINGS * 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: (number | 'gap')[] = [1]
  const start = Math.max(2, page - SIBLINGS)
  const end = Math.min(totalPages - 1, page + SIBLINGS)

  if (start > 2) items.push('gap')
  for (let value = start; value <= end; value += 1) items.push(value)
  if (end < totalPages - 1) items.push('gap')
  items.push(totalPages)

  return items
}

// Page buttons from the storefront frame (Figma 97:9785): 36px squares on the
// dark page, the current page inverted to white. The arrow assets come in an
// enabled (white) and a disabled (30% white) tone, so the disabled end swaps
// to the dim one rather than fading the button.
function Pagination({ page, totalPages, onChange, label = 'Halaman' }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const atStart = page <= 1
  const atEnd = page >= totalPages

  return (
    <nav className="pagination" aria-label={label}>
      <button
        className="pagination__button"
        type="button"
        aria-label="Halaman sebelumnya"
        disabled={atStart}
        onClick={() => onChange(page - 1)}
      >
        <img src={atStart ? pagePrevIcon : pageNextIcon} alt="" width={16} height={16} />
      </button>

      {pageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span className="pagination__gap" key={`gap-${index}`} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            className={
              item === page
                ? 'pagination__button pagination__button--current'
                : 'pagination__button'
            }
            type="button"
            key={item}
            aria-label={`Halaman ${item}`}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ),
      )}

      <button
        className="pagination__button pagination__button--next"
        type="button"
        aria-label="Halaman berikutnya"
        disabled={atEnd}
        onClick={() => onChange(page + 1)}
      >
        <img src={atEnd ? pagePrevIcon : pageNextIcon} alt="" width={16} height={16} />
      </button>
    </nav>
  )
}

export default Pagination
