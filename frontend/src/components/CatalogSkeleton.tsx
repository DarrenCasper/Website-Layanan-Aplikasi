import './CatalogSkeleton.scss'

// Cards drawn while the catalog loads. Twelve fills two full rows of the six
// column desktop grid and still reads as a grid once the columns drop away.
const SKELETON_CARD_COUNT = 12

// Frames in the detail gallery's thumbnail strip.
const SKELETON_THUMB_COUNT = 6

// Paragraph groups in the detail skeleton's description block. Each group is
// two lines, which is what the real paragraphs average, so the block is close
// to the height the real description will take.
const SKELETON_PARAGRAPH_COUNT = 4

/**
 * Card shaped placeholders for the Explore grid.
 *
 * These deliberately reuse `.product-card` and its children rather than
 * restating the card's box model here. The placeholder therefore inherits the
 * real padding, radius, image aspect ratio and fixed text block height, which
 * is what keeps the grid from shifting when the actual cards arrive. It also
 * means any later change to the card's dimensions reaches the skeleton for
 * free instead of drifting away from it.
 *
 * Render inside the page's own `.explore__grid` so the column count is the
 * grid's, not a copy of it.
 */
export function SkeletonCards({ count = SKELETON_CARD_COUNT }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card skeleton-card" key={index} aria-hidden="true">
          <span className="product-card__image skeleton-block" />

          <span className="product-card__texts">
            <span className="skeleton-line skeleton-line--name" />
            <span className="skeleton-line skeleton-line--price" />
            <span className="skeleton-line skeleton-line--meta" />
          </span>
        </div>
      ))}
    </>
  )
}

/**
 * Placeholder for the Product Description screen.
 *
 * Like the card skeleton this borrows the page's real layout classes
 * (`.detail__body`, `.detail__card`, `.detail__buy` and their children), so the
 * placeholder sits exactly where the content will and the page does not jump
 * when the product resolves.
 */
export function SkeletonDetail() {
  return (
    <div className="detail__body" aria-hidden="true">
      <article className="detail__card">
        <div className="detail__core">
          <div className="detail__gallery">
            <span className="detail__hero skeleton-block" />

            <div className="detail__thumbs">
              {Array.from({ length: SKELETON_THUMB_COUNT }, (_, index) => (
                <span className="detail__thumb skeleton-block" key={index} />
              ))}
            </div>
          </div>

          <div className="detail__summary">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--amount" />
            <span className="skeleton-line skeleton-line--stats" />
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line skeleton-line--field" />
          </div>
        </div>

        <div className="detail__description">
          <div className="detail__description-head">
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line skeleton-line--stats" />
          </div>

          <div className="detail__description-body">
            {Array.from({ length: SKELETON_PARAGRAPH_COUNT }, (_, index) => (
              <span className="skeleton-paragraph" key={index}>
                <span className="skeleton-line skeleton-line--para" />
                <span className="skeleton-line skeleton-line--para skeleton-line--para-short" />
              </span>
            ))}
          </div>
        </div>

        <div className="detail__merchant">
          <span className="detail__merchant-avatar skeleton-block" />

          <div className="detail__merchant-text">
            <span className="skeleton-line skeleton-line--meta" />
            <span className="skeleton-line skeleton-line--stats" />
          </div>
        </div>
      </article>

      <aside className="detail__buy">
        <div className="detail__buy-core">
          <span className="skeleton-line skeleton-line--label" />

          <div className="detail__buy-summary">
            <span className="detail__buy-thumb skeleton-block" />
            <span className="skeleton-line skeleton-line--buy-text" />
          </div>

          <span className="skeleton-line skeleton-line--qty" />
        </div>

        <span className="skeleton-line skeleton-line--cart" />
      </aside>
    </div>
  )
}

/**
 * Announced to assistive technology while a placeholder is on screen, so a
 * screen reader hears that content is loading instead of an unexplained pause.
 */
export function SkeletonStatus({ label }: { label: string }) {
  return (
    <p className="skeleton-status" role="status">
      {label}
    </p>
  )
}
