import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import ProductCard from '../components/ProductCard'
import {
  DEPARTMENT_SECTION,
  FTEIC_SECTION,
  loadCatalogProducts,
  type CatalogProduct,
  type CatalogSource,
} from '../lib/catalog'
import './ExplorePage.scss'

// Explore Page (Figma 25:2). The signed-in landing screen: a sticky bar, the
// empty filter panel the design reserves on the left, and the product grids on
// the right. Cards come from the API when it has listings and from the curated
// mock catalog otherwise, so the page always matches the design.
function ExplorePage() {
  const navigate = useNavigate()

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [source, setSource] = useState<CatalogSource>('mock')
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const matches = useMemo(() => {
    if (query === '') {
      return products
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.tags.some((tag) => tag.toLowerCase().includes(query)),
    )
  }, [products, query])

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

  return (
    <main className="explore">
      <NavBar searchValue={search} onSearchChange={setSearch} />

      <div className="explore__content">
        <div className="explore__filter">
          {/* The design reserves this panel but leaves it empty. */}
          <div className="explore__filter-panel" />
        </div>

        <div className="explore__items">
          <p className="explore__heading">{departmentHeading}</p>

          {isLoading || departmentProducts.length > 0 ? (
            <div className="explore__grid">
              {departmentProducts.map((product) => (
                <ProductCard key={product.id} product={product} onClick={openProduct} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {hasFteicSection ? (
        <div className="explore__section">
          <p className="explore__heading">{FTEIC_SECTION}</p>

          {isLoading || fteicProducts.length > 0 ? (
            <div className="explore__grid">
              {fteicProducts.map((product) => (
                <ProductCard key={product.id} product={product} onClick={openProduct} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showNotice ? (
        <p className="explore__notice">
          Katalog contoh ditampilkan karena belum ada barang dari penjual.
        </p>
      ) : null}
    </main>
  )
}

export default ExplorePage
