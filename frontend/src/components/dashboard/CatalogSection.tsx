import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/authContext'
import { ApiError, isAbortError, toErrorMessage } from '../../lib/api'
import { formatRupiah, type CatalogProduct } from '../../lib/catalog'
import { findCategory, type CatalogType } from '../../lib/categories'
import {
  deleteListing,
  loadMerchantListings,
  type MerchantListings,
} from '../../lib/merchantCatalog'
import type { MerchantProfile } from '../../lib/merchants'
import { useCategories } from '../../lib/useCategories'
import Modal from '../Modal'
import ListingFormModal from './ListingFormModal'
import plusIcon from '../../assets/icons/plus-white-sm.svg'
import searchIcon from '../../assets/icons/search-dark.svg'
import editIcon from '../../assets/icons/edit.svg'
import trashIcon from '../../assets/icons/trash.svg'
import trashWhiteIcon from '../../assets/icons/trash-white.svg'
import alertIcon from '../../assets/icons/alert.svg'

type Props = {
  merchant: MerchantProfile
  onForbidden: () => void
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; data: MerchantListings }
  | { status: 'error'; message: string }

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; listing: CatalogProduct }
  | { kind: 'delete'; listing: CatalogProduct }
  | null

// "Produk & jasa" (Figma 97:8325): the store's own listings with add, edit and
// delete. Changes update the list in place, without a reload.
function CatalogSection({ merchant, onForbidden }: Props) {
  const { token } = useAuth()
  const categories = useCategories()
  const [type, setType] = useState<CatalogType>('product')
  const [lists, setLists] = useState<Record<CatalogType, ListState>>({
    product: { status: 'loading' },
    service: { status: 'loading' },
  })
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    for (const kind of ['product', 'service'] as const) {
      loadMerchantListings(merchant.id, kind, controller.signal).then(
        (data) => setLists((current) => ({ ...current, [kind]: { status: 'ready', data } })),
        (error: unknown) => {
          if (isAbortError(error)) return
          setLists((current) => ({
            ...current,
            [kind]: { status: 'error', message: toErrorMessage(error) },
          }))
        },
      )
    }

    return () => controller.abort()
  }, [merchant.id, reload])

  const current = lists[type]
  const data = current.status === 'ready' ? current.data : null
  const count = (kind: CatalogType) => {
    const list = lists[kind]
    return list.status === 'ready' ? list.data.items.length : null
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const items = data?.items ?? []

    return needle
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            item.tags.some((tag) => tag.includes(needle)),
        )
      : items
  }, [data, search])

  const noun = type === 'service' ? 'jasa' : 'produk'

  const upsert = (listing: CatalogProduct, category: string) => {
    setLists((all) => {
      const list = all[type]
      if (list.status !== 'ready') return all
      const others = list.data.items.filter((item) => item.id !== listing.id)
      return {
        ...all,
        [type]: {
          status: 'ready',
          data: {
            items: [...others, listing].sort((a, b) => a.name.localeCompare(b.name, 'id')),
            categories: { ...list.data.categories, [listing.id]: category },
          },
        },
      }
    })
  }

  const handleDelete = async (listing: CatalogProduct) => {
    if (!token) return

    setDeleting(true)
    setDeleteError(null)

    try {
      await deleteListing(merchant.id, type, listing.id, token)
      setLists((all) => {
        const list = all[type]
        if (list.status !== 'ready') return all
        return {
          ...all,
          [type]: {
            status: 'ready',
            data: { ...list.data, items: list.data.items.filter((item) => item.id !== listing.id) },
          },
        }
      })
      setDialog(null)
      setNotice(`"${listing.name}" dihapus.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        onForbidden()
        return
      }
      setDeleteError(toErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const quantityLabel = (item: CatalogProduct) => {
    if (type === 'service') return `${item.durationMin ?? 0} mnt`
    return item.stock > 0 ? String(item.stock) : 'Habis'
  }

  return (
    <section className="dash-card" aria-labelledby="catalog-title">
      <div className="dash-card__head">
        <h1 className="dash-card__title" id="catalog-title">
          Produk &amp; jasa
        </h1>
        <button
          className="ui-btn ui-btn--primary ui-btn--sm"
          type="button"
          onClick={() => {
            setNotice(null)
            setDialog({ kind: 'create' })
          }}
        >
          <img src={plusIcon} alt="" width={16} height={16} />
          <span className="dash-hide-phone">Tambah {noun}</span>
          <span className="dash-show-phone">Tambah</span>
        </button>
      </div>

      {merchant.status === 'PENDING' ? (
        <p className="dash-note">
          Tokomu sedang menunggu verifikasi admin, jadi katalogmu belum tampil di Explore.
        </p>
      ) : null}

      <div className="dash-toolbar">
        <div className="dash-segment" role="tablist" aria-label="Jenis katalog">
          {(
            [
              ['product', 'Produk'],
              ['service', 'Jasa'],
            ] as const
          ).map(([value, label]) => {
            const n = count(value)
            return (
              <button
                className={
                  type === value
                    ? 'dash-segment__item dash-segment__item--on'
                    : 'dash-segment__item'
                }
                type="button"
                role="tab"
                aria-selected={type === value}
                key={value}
                onClick={() => {
                  setType(value)
                  setSearch('')
                }}
              >
                {label}
                {n === null ? '' : ` (${n})`}
              </button>
            )
          })}
        </div>

        <label className="dash-search">
          <input
            className="ui-input"
            type="search"
            aria-label="Cari di katalog tokomu"
            placeholder="Cari di katalog tokomu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <img src={searchIcon} alt="" width={18} height={18} />
        </label>
      </div>

      {notice ? (
        <p className="dash-toast" role="status">
          {notice}
        </p>
      ) : null}

      {current.status === 'loading' ? (
        <p className="dash__muted dash__muted--ink">Memuat katalog…</p>
      ) : null}

      {current.status === 'error' ? (
        <div className="dash-empty" role="alert">
          <p>{current.message}</p>
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            onClick={() => setReload((n) => n + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {data && visible.length === 0 ? (
        <div className="dash-empty">
          <p>
            {search
              ? `Tidak ada ${noun} yang cocok dengan "${search}".`
              : `Belum ada ${noun}. Tambahkan ${noun} pertamamu.`}
          </p>
        </div>
      ) : null}

      {data && visible.length > 0 ? (
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">Nama</th>
              <th scope="col">Kategori</th>
              <th scope="col">Harga</th>
              <th scope="col">{type === 'service' ? 'Durasi' : 'Stok'}</th>
              <th scope="col">
                <span className="fp-visually-hidden">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const categoryName =
                findCategory(categories, data.categories[item.id] ?? null)?.name ??
                item.category ??
                null
              const soldOut = type === 'product' && item.stock <= 0

              return (
                <tr key={item.id} className={soldOut ? 'dash-row dash-row--out' : 'dash-row'}>
                  <td className="dash-row__name">
                    <img
                      className="dash-row__thumb"
                      src={item.image}
                      alt=""
                      width={40}
                      height={40}
                    />
                    <span>{item.name}</span>
                  </td>
                  <td className="dash-row__category">
                    {categoryName ? (
                      <span className="ui-badge">{categoryName}</span>
                    ) : (
                      <span className="dash-row__none">—</span>
                    )}
                  </td>
                  <td className="dash-row__price">{formatRupiah(item.price)}</td>
                  <td className="dash-row__qty" data-label={type === 'service' ? 'Durasi' : 'Stok'}>
                    {quantityLabel(item)}
                  </td>
                  <td className="dash-row__actions">
                    <button
                      className="ui-icon-btn"
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => {
                        setNotice(null)
                        setDialog({ kind: 'edit', listing: item })
                      }}
                    >
                      <img src={editIcon} alt="" width={16} height={16} />
                    </button>
                    <button
                      className="ui-icon-btn"
                      type="button"
                      aria-label={`Hapus ${item.name}`}
                      onClick={() => {
                        setNotice(null)
                        setDeleteError(null)
                        setDialog({ kind: 'delete', listing: item })
                      }}
                    >
                      <img src={trashIcon} alt="" width={16} height={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <ListingFormModal
          merchantId={merchant.id}
          type={type}
          categories={categories}
          listing={dialog.kind === 'edit' ? dialog.listing : null}
          listingCategory={
            dialog.kind === 'edit' ? (data?.categories[dialog.listing.id] ?? '') : ''
          }
          existingNames={(data?.items ?? [])
            .filter((item) => dialog.kind !== 'edit' || item.id !== dialog.listing.id)
            .map((item) => item.name)}
          onClose={() => setDialog(null)}
          onForbidden={onForbidden}
          onSaved={(listing, category, unsavedNote) => {
            upsert(listing, category)
            setDialog(null)
            setNotice(
              unsavedNote ??
                (dialog.kind === 'edit'
                  ? `Perubahan "${listing.name}" disimpan.`
                  : `"${listing.name}" ditambahkan.`),
            )
          }}
        />
      ) : null}

      {dialog?.kind === 'delete' ? (
        <Modal
          title={type === 'service' ? 'Hapus jasa?' : 'Hapus produk?'}
          size="sm"
          busy={deleting}
          onClose={() => setDialog(null)}
        >
          <p className="dash-confirm">
            "{dialog.listing.name}" akan dihapus dari katalog tokomu dan tidak bisa dikembalikan.
          </p>
          {deleteError ? (
            <p className="ui-error" role="alert">
              <img src={alertIcon} alt="" width={14} height={14} />
              {deleteError}
            </p>
          ) : null}
          <div className="ui-actions">
            <button
              className="ui-btn ui-btn--ghost"
              type="button"
              disabled={deleting}
              onClick={() => setDialog(null)}
            >
              Batal
            </button>
            <button
              className="ui-btn ui-btn--danger"
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete(dialog.listing)}
            >
              <img src={trashWhiteIcon} alt="" width={18} height={18} />
              {deleting ? 'Menghapus…' : 'Hapus'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

export default CatalogSection
