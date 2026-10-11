import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { formatRupiah, loadCatalogProducts, type CatalogProduct } from '../lib/catalog'
import { productImages } from '../lib/mockCatalog'
import minusIcon from '../assets/catalog/icon-minus.svg'
import plusIcon from '../assets/catalog/icon-plus.svg'
import './ProductDetailPage.scss'

// The design shows a six frame thumbnail strip under the hero. The first frame
// is the product's own artwork and the rest fall back to the standard render
// the Figma file uses, which is what keeps the strip looking like the mock.
const THUMBNAIL_COUNT = 6
const THUMBNAIL_FALLBACK = productImages[0]
const CART_CONFIRMATION_MS = 2000

// Product Description (Figma 43:107). The item card carries the gallery, the
// price, the variant pills and the schedule picker; the panel beside it holds
// the quantity stepper and the add to cart button.
function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [pickupDate, setPickupDate] = useState('')
  const [isAdded, setIsAdded] = useState(false)
  const confirmationTimer = useRef<number | null>(null)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      const { products } = await loadCatalogProducts()
      const found = products.find((entry) => entry.id === id) ?? null

      if (!isActive) {
        return
      }

      // An unknown id would otherwise render an empty shell, so send the
      // visitor back to the catalog instead.
      if (!found) {
        navigate('/', { replace: true })
        return
      }

      setProduct(found)
      setSelectedVariant(found.variants[0] ?? null)
      setQuantity(1)
      setImageIndex(0)
    }

    void load()

    return () => {
      isActive = false
    }
  }, [id, navigate])

  // The confirmation label reverts on its own, so the timer has to be cleared
  // if the page unmounts first.
  useEffect(() => {
    return () => {
      if (confirmationTimer.current !== null) {
        window.clearTimeout(confirmationTimer.current)
      }
    }
  }, [])

  const thumbnails = useMemo(() => {
    if (!product) {
      return []
    }

    const frames = [product.image]

    while (frames.length < THUMBNAIL_COUNT) {
      frames.push(THUMBNAIL_FALLBACK)
    }

    return frames
  }, [product])

  const descriptionParagraphs = useMemo(() => {
    if (!product) {
      return []
    }

    return product.description
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== '')
  }, [product])

  if (!product) {
    return (
      <main className="detail">
        <NavBar />
      </main>
    )
  }

  const subtitle = selectedVariant ? `Varian ${selectedVariant}` : product.merchantName
  const mainImage = thumbnails[imageIndex] ?? product.image

  // Stock zero still leaves one unit selectable, but the plus button is inert.
  const maxQuantity = product.stock > 0 ? product.stock : 1
  const canDecrease = quantity > 1
  const canIncrease = quantity < maxQuantity

  const handleDecrease = () => {
    setQuantity((value) => Math.max(1, value - 1))
  }

  const handleIncrease = () => {
    setQuantity((value) => Math.min(maxQuantity, value + 1))
  }

  const handleAddToCart = () => {
    if (confirmationTimer.current !== null) {
      window.clearTimeout(confirmationTimer.current)
    }

    setIsAdded(true)
    confirmationTimer.current = window.setTimeout(() => {
      setIsAdded(false)
      confirmationTimer.current = null
    }, CART_CONFIRMATION_MS)
  }

  return (
    <main className="detail">
      <NavBar />

      <div className="detail__body">
        <article className="detail__card">
          <div className="detail__core">
            <div className="detail__gallery">
              <img className="detail__hero" src={mainImage} alt="" />

              <div className="detail__thumbs">
                {thumbnails.map((thumbnail, index) => (
                  <button
                    key={`${thumbnail}-${index}`}
                    className={
                      index === imageIndex
                        ? 'detail__thumb detail__thumb--selected'
                        : 'detail__thumb'
                    }
                    type="button"
                    aria-label={`Lihat gambar ${index + 1}`}
                    aria-pressed={index === imageIndex}
                    onClick={() => setImageIndex(index)}
                  >
                    <img className="detail__thumb-image" src={thumbnail} alt="" />
                  </button>
                ))}
              </div>
            </div>

            <div className="detail__summary">
              <h1 className="detail__title">{product.name}</h1>

              <div className="detail__price-block">
                <p className="detail__price">{formatRupiah(product.price)}</p>
                <p className="detail__stats">
                  {product.rating.toFixed(1)} | {product.sold} terjual
                </p>
              </div>

              {product.variants.length > 0 ? (
                <div className="detail__variants">
                  <p className="detail__variants-title">Pilih GPU</p>
                  <div className="detail__variant-list">
                    {product.variants.map((variant) => (
                      <button
                        key={variant}
                        className={
                          variant === selectedVariant
                            ? 'detail__variant detail__variant--selected'
                            : 'detail__variant'
                        }
                        type="button"
                        aria-pressed={variant === selectedVariant}
                        onClick={() =>
                          setSelectedVariant(variant === selectedVariant ? null : variant)
                        }
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="detail__schedule">
                <p className="detail__schedule-title">Pilih jadwal pengambilan</p>

                <div className="detail__date-field">
                  <input
                    className={
                      pickupDate === ''
                        ? 'detail__date-input detail__date-input--empty'
                        : 'detail__date-input'
                    }
                    type="date"
                    aria-label="Pilih jadwal pengambilan"
                    value={pickupDate}
                    onChange={(event) => setPickupDate(event.target.value)}
                  />

                  {pickupDate === '' ? (
                    <span className="detail__date-placeholder">Pick a date</span>
                  ) : null}

                  <svg
                    className="detail__date-icon"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="detail__description">
            <div className="detail__description-head">
              <p className="detail__description-title">Deskripsi Item</p>
              <p className="detail__description-subtitle">{subtitle}</p>
            </div>

            <div className="detail__description-body">
              {descriptionParagraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="detail__merchant">
            <span className="detail__merchant-avatar" aria-hidden="true" />

            <div className="detail__merchant-text">
              <p className="detail__merchant-name">{product.merchantName}</p>
              <p className="detail__merchant-city">{product.merchantCity}</p>
            </div>
          </div>
        </article>

        <aside className="detail__buy">
          <div className="detail__buy-core">
            <h2 className="detail__buy-title">Mau yang ini berapa?</h2>

            <div className="detail__buy-summary">
              <span className="detail__buy-thumb" aria-hidden="true" />
              <p className="detail__buy-subtitle">{subtitle}</p>
            </div>

            <div className="detail__quantity-row">
              <div className="detail__quantity">
                <button
                  className="detail__quantity-button"
                  type="button"
                  aria-label="Kurangi jumlah"
                  disabled={!canDecrease}
                  onClick={handleDecrease}
                >
                  <img src={minusIcon} alt="" aria-hidden="true" />
                </button>

                <span className="detail__quantity-value">{quantity}</span>

                <button
                  className="detail__quantity-button"
                  type="button"
                  aria-label="Tambah jumlah"
                  disabled={!canIncrease}
                  onClick={handleIncrease}
                >
                  <img src={plusIcon} alt="" aria-hidden="true" />
                </button>
              </div>

              <p className="detail__stock">Stok: {product.stock}</p>
            </div>
          </div>

          <button
            className="detail__cart-button"
            type="button"
            disabled={isAdded}
            onClick={handleAddToCart}
          >
            {isAdded ? 'Ditambahkan' : '+ Keranjang'}
          </button>
        </aside>
      </div>
    </main>
  )
}

export default ProductDetailPage
