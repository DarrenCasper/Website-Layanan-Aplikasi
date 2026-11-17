import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useAuth } from '../../context/authContext'
import { ApiError, toErrorMessage } from '../../lib/api'
import type { CatalogProduct } from '../../lib/catalog'
import { categoriesFor, type CatalogType, type Category } from '../../lib/categories'
import { formatPriceInput, parsePriceInput } from '../../lib/catalogFilters'
import {
  LISTING_LIMITS,
  createListing,
  fieldForApiError,
  normalizeTag,
  updateListing,
  validateListing,
  type ListingErrors,
  type ListingField,
  type ListingInput,
} from '../../lib/merchantCatalog'
import Modal from '../Modal'
import alertIcon from '../../assets/icons/alert.svg'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import tagCloseIcon from '../../assets/icons/x-tag.svg'

type Props = {
  merchantId: string
  type: CatalogType
  categories: Category[]
  /** The listing being edited, or null to add a new one. */
  listing: CatalogProduct | null
  listingCategory: string
  existingNames: string[]
  onClose: () => void
  onForbidden: () => void
  onSaved: (listing: CatalogProduct, category: string, unsavedNote: string | null) => void
}

const FIELD_LABEL: Record<ListingField, string> = {
  name: 'nama',
  price: 'harga',
  quantity: 'jumlah',
  description: 'deskripsi',
  category: 'kategori',
  tags: 'tag',
}

// Add and edit form (Figma 97:8607 "Tambah produk", 97:8839 "Edit jasa").
// Client checks match the backend's limits; anything the backend still rejects
// is shown under the field it names.
function ListingFormModal({
  merchantId,
  type,
  categories,
  listing,
  listingCategory,
  existingNames,
  onClose,
  onForbidden,
  onSaved,
}: Props) {
  const { token } = useAuth()
  const ids = useId()
  const isService = type === 'service'
  const noun = isService ? 'jasa' : 'produk'
  const options = categoriesFor(categories, type)

  const [name, setName] = useState(listing?.name ?? '')
  const [price, setPrice] = useState(listing ? formatPriceInput(listing.price) : '')
  const [quantity, setQuantity] = useState(
    listing ? String(isService ? (listing.durationMin ?? 0) : listing.stock) : '',
  )
  const [category, setCategory] = useState(listingCategory)
  const [tags, setTags] = useState<string[]>(listing?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [description, setDescription] = useState(listing?.rawDescription ?? '')
  const [errors, setErrors] = useState<ListingErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fieldId = (field: string) => `${ids}-${field}`

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag) return

    if (tags.includes(tag)) {
      setTagDraft('')
      return
    }

    if (tags.length >= LISTING_LIMITS.tagsMax) {
      setErrors((current) => ({ ...current, tags: `Maksimal ${LISTING_LIMITS.tagsMax} tag` }))
      return
    }

    setTags([...tags, tag])
    setTagDraft('')
    setErrors((current) => ({ ...current, tags: undefined }))
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagDraft)
    } else if (event.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    // A tag typed but not yet confirmed with Enter is still meant to be saved.
    const pendingTag = normalizeTag(tagDraft)
    const allTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags

    const input: ListingInput = {
      name,
      price: parsePriceInput(price) ?? Number.NaN,
      quantity: quantity.trim() === '' ? Number.NaN : Number(quantity),
      description,
      category,
      tags: allTags,
    }
    const found = validateListing(input, existingNames)

    if (isService && found.quantity) found.quantity = 'Isi durasi dalam menit, angka bulat'
    if (!isService && found.quantity) found.quantity = 'Isi stok dengan angka bulat 0 atau lebih'
    if (found.name?.includes('dipakai'))
      found.name = `Nama ini sudah dipakai ${noun} lain di tokomu`

    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    setTags(allTags)
    setTagDraft('')
    setSaving(true)

    try {
      const result = listing
        ? await updateListing(merchantId, type, listing, listingCategory, input, token)
        : await createListing(merchantId, type, input, token)
      const note =
        result.unsaved.length > 0
          ? `Perubahan disimpan, kecuali ${result.unsaved
              .map((field) => FIELD_LABEL[field])
              .join(' dan ')}: server belum mendukung mengubahnya.`
          : null

      onSaved(result.listing, category, note)
    } catch (error) {
      setSaving(false)

      if (error instanceof ApiError && error.status === 403) {
        onForbidden()
        return
      }

      const field = error instanceof ApiError ? fieldForApiError(error) : null
      if (field && error instanceof ApiError && (error.status === 400 || error.status === 409)) {
        setErrors({ [field]: error.message })
      } else {
        setFormError(toErrorMessage(error))
      }
    }
  }

  const errorText = (field: ListingField) =>
    errors[field] ? (
      <p className="ui-error" id={fieldId(`${field}-error`)} role="alert">
        <img src={alertIcon} alt="" width={14} height={14} />
        {errors[field]}
      </p>
    ) : null

  const inputClass = (field: ListingField, extra = '') =>
    `ui-input${extra ? ` ${extra}` : ''}${errors[field] ? ' ui-input--invalid' : ''}`

  const describedBy = (field: ListingField, help?: string) =>
    [errors[field] ? fieldId(`${field}-error`) : null, help ?? null].filter(Boolean).join(' ') ||
    undefined

  return (
    <Modal title={listing ? `Edit ${noun}` : `Tambah ${noun}`} onClose={onClose} busy={saving}>
      <form className="listing-form" onSubmit={handleSubmit} noValidate>
        <div className="ui-field">
          <label className="ui-label" htmlFor={fieldId('name')}>
            Nama {noun} <span className="ui-required">*</span>
          </label>
          <input
            id={fieldId('name')}
            className={inputClass('name')}
            maxLength={LISTING_LIMITS.nameMax}
            value={name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
            onChange={(event) => setName(event.target.value)}
          />
          {errorText('name')}
        </div>

        <div className="listing-form__row">
          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('price')}>
              Harga <span className="ui-required">*</span>
            </label>
            <span className={`ui-affix${errors.price ? ' ui-affix--invalid' : ''}`}>
              <span className="ui-affix__prefix" aria-hidden="true">
                Rp
              </span>
              <input
                id={fieldId('price')}
                className="ui-affix__input"
                inputMode="numeric"
                autoComplete="off"
                value={price}
                aria-invalid={Boolean(errors.price)}
                aria-describedby={describedBy('price')}
                onChange={(event) =>
                  setPrice(formatPriceInput(parsePriceInput(event.target.value)))
                }
              />
            </span>
            {errorText('price')}
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('quantity')}>
              {isService ? 'Durasi (menit)' : 'Stok'} <span className="ui-required">*</span>
            </label>
            <input
              id={fieldId('quantity')}
              className={inputClass('quantity')}
              inputMode="numeric"
              autoComplete="off"
              value={quantity}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={describedBy('quantity')}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 9))}
            />
            {errorText('quantity')}
          </div>
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={fieldId('category')}>
            Kategori <span className="ui-required">*</span>
          </label>
          <span className="ui-select">
            <select
              id={fieldId('category')}
              className={inputClass('category')}
              value={category}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={describedBy('category', fieldId('category-help'))}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="" disabled>
                Pilih kategori
              </option>
              <optgroup label="Kategori spesifik">
                {options
                  .filter((entry) => entry.kind === 'specific')
                  .map((entry) => (
                    <option key={entry.slug} value={entry.slug}>
                      {entry.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kategori umum">
                {options
                  .filter((entry) => entry.kind === 'fallback')
                  .map((entry) => (
                    <option key={entry.slug} value={entry.slug}>
                      {entry.name}
                    </option>
                  ))}
              </optgroup>
            </select>
            <img src={chevronDownIcon} alt="" width={18} height={18} />
          </span>
          {errorText('category') ?? (
            <p className="ui-help" id={fieldId('category-help')}>
              Pilih satu kategori. Pilih "
              {options.find((entry) => entry.kind === 'fallback')?.name ?? 'Barang Lainnya'}" kalau
              tidak ada yang cocok.
            </p>
          )}
        </div>

        <div className="ui-field">
          <div className="ui-label-row">
            <label className="ui-label" htmlFor={fieldId('tags')}>
              Tag
            </label>
            <span className="ui-help">
              {tags.length}/{LISTING_LIMITS.tagsMax}
            </span>
          </div>
          <div className={`ui-tags${errors.tags ? ' ui-tags--invalid' : ''}`}>
            {tags.map((tag) => (
              <span className="ui-tag" key={tag}>
                {tag}
                <button
                  type="button"
                  aria-label={`Hapus tag ${tag}`}
                  onClick={() => setTags(tags.filter((entry) => entry !== tag))}
                >
                  <img src={tagCloseIcon} alt="" width={12} height={12} />
                </button>
              </span>
            ))}
            <input
              id={fieldId('tags')}
              className="ui-tags__input"
              placeholder={tags.length >= LISTING_LIMITS.tagsMax ? '' : 'Tambah tag, tekan Enter'}
              maxLength={LISTING_LIMITS.tagMax}
              value={tagDraft}
              disabled={tags.length >= LISTING_LIMITS.tagsMax}
              aria-describedby={describedBy('tags')}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => addTag(tagDraft)}
            />
          </div>
          {errorText('tags')}
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={fieldId('description')}>
            Deskripsi <span className="ui-optional">(opsional)</span>
          </label>
          <textarea
            id={fieldId('description')}
            className={inputClass('description', 'ui-textarea')}
            maxLength={LISTING_LIMITS.descriptionMax}
            value={description}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={describedBy('description')}
            onChange={(event) => setDescription(event.target.value)}
          />
          {errorText('description')}
        </div>

        {formError ? (
          <p className="ui-error" role="alert">
            <img src={alertIcon} alt="" width={14} height={14} />
            {formError}
          </p>
        ) : null}

        <div className="ui-actions">
          <button
            className="ui-btn ui-btn--ghost"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button className="ui-btn ui-btn--primary" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : listing ? 'Simpan perubahan' : `Simpan ${noun}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ListingFormModal
