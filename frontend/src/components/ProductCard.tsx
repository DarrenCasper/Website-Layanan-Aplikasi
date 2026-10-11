import { formatRupiah, type CatalogProduct } from '../lib/catalog'
import cartAddIcon from '../assets/catalog/icon-cart-add.svg'
import './ProductCard.scss'

type ProductCardProps = {
  product: CatalogProduct
  onClick: (id: string) => void
}

// One tile of the Explore grid (Figma 26:56). Rendered as a button so the whole
// card is keyboard reachable, which is why the inner pieces are spans: a button
// may only contain phrasing content.
function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <button className="product-card" type="button" onClick={() => onClick(product.id)}>
      <img className="product-card__image" src={product.image} alt="" />

      <span className="product-card__texts">
        <span className="product-card__name" title={product.name}>
          {product.name}
        </span>
        <span className="product-card__price">{formatRupiah(product.price)}</span>

        <span className="product-card__meta">
          <span className="product-card__stats">
            {product.rating.toFixed(1)} | {product.sold} terjual
          </span>
          <img className="product-card__cart" src={cartAddIcon} alt="" aria-hidden="true" />
        </span>
      </span>
    </button>
  )
}

export default ProductCard
