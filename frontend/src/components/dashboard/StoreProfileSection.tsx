import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/authContext'
import { ApiError, toErrorMessage } from '../../lib/api'
import {
  addMerchantMember,
  initialsOf,
  removeMerchantMember,
  updateMerchantProfile,
  type MerchantMember,
  type MerchantProfile,
} from '../../lib/merchants'
import editIcon from '../../assets/icons/edit.svg'
import plusIcon from '../../assets/icons/plus-white.svg'
import trashIcon from '../../assets/icons/trash.svg'
import alertIcon from '../../assets/icons/alert.svg'

const NAME_MIN = 3
const NAME_MAX = 50
const DESC_MAX = 500

type Props = {
  merchant: MerchantProfile
  isOwner: boolean
  onChange: (merchant: MerchantProfile) => void
  onForbidden: () => void
}

// Store profile and members (Figma 97:7989, 97:8013; owner edit 97:8064;
// member read-only 97:8184).
function StoreProfileSection({ merchant, isOwner, onChange, onForbidden }: Props) {
  return (
    <>
      <ProfileCard
        merchant={merchant}
        isOwner={isOwner}
        onChange={onChange}
        onForbidden={onForbidden}
      />
      <MembersCard
        merchant={merchant}
        isOwner={isOwner}
        onChange={onChange}
        onForbidden={onForbidden}
      />
    </>
  )
}

function ProfileCard({ merchant, isOwner, onChange, onForbidden }: Props) {
  const { token } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(merchant.namaToko)
  const [description, setDescription] = useState(merchant.deskripsi)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setName(merchant.namaToko)
    setDescription(merchant.deskripsi)
    setNameError(null)
    setFormError(null)
    setEditing(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()

    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      setNameError(`Nama toko ${NAME_MIN} sampai ${NAME_MAX} karakter`)
      return
    }

    if (!token) return

    setSaving(true)
    setNameError(null)
    setFormError(null)

    try {
      onChange(
        await updateMerchantProfile(
          merchant,
          { namaToko: trimmed, deskripsi: description.trim() },
          token,
        ),
      )
      setEditing(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        onForbidden()
        return
      }
      const message = toErrorMessage(error)
      if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 409) &&
        /nama|name/i.test(message)
      ) {
        setNameError(message)
      } else {
        setFormError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form className="dash-card" onSubmit={handleSubmit} noValidate>
        <h1 className="dash-card__title">Profil toko</h1>

        <div className="ui-field">
          <label className="ui-label" htmlFor="profile-name">
            Nama toko <span className="ui-required">*</span>
          </label>
          <input
            id="profile-name"
            className={nameError ? 'ui-input ui-input--invalid' : 'ui-input'}
            maxLength={NAME_MAX}
            value={name}
            aria-invalid={Boolean(nameError)}
            aria-describedby="profile-name-help"
            onChange={(event) => setName(event.target.value)}
          />
          {nameError ? (
            <p className="ui-error" id="profile-name-help" role="alert">
              <img src={alertIcon} alt="" width={14} height={14} />
              {nameError}
            </p>
          ) : (
            <p className="ui-help" id="profile-name-help">
              {NAME_MIN} sampai {NAME_MAX} karakter
            </p>
          )}
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor="profile-desc">
            Deskripsi
          </label>
          <textarea
            id="profile-desc"
            className="ui-input ui-textarea"
            maxLength={DESC_MAX}
            value={description}
            aria-describedby="profile-desc-count"
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="ui-help" id="profile-desc-count">
            {description.length}/{DESC_MAX}
          </p>
        </div>

        {formError ? (
          <p className="ui-error" role="alert">
            <img src={alertIcon} alt="" width={14} height={14} />
            {formError}
          </p>
        ) : null}

        <div className="ui-actions">
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Batal
          </button>
          <button className="ui-btn ui-btn--primary ui-btn--sm" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="dash-card" aria-labelledby="profile-title">
      <div className="dash-card__head">
        <h1 className="dash-card__title" id="profile-title">
          Profil toko
        </h1>
        {isOwner ? (
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={startEditing}>
            <img src={editIcon} alt="" width={16} height={16} />
            Edit profil
          </button>
        ) : null}
      </div>

      <dl className="dash-profile">
        <div className="dash-profile__item">
          <dt>Nama toko</dt>
          <dd className="dash-profile__name">{merchant.namaToko}</dd>
        </div>
        <div className="dash-profile__item">
          <dt>Deskripsi</dt>
          <dd className="dash-profile__desc">{merchant.deskripsi || 'Belum ada deskripsi.'}</dd>
        </div>
      </dl>

      <hr className="dash-card__rule" />

      <dl className="dash-stats">
        <div>
          <dd>{merchant.productCount}</dd>
          <dt>Produk</dt>
        </div>
        <div>
          <dd>{merchant.serviceCount}</dd>
          <dt>Jasa</dt>
        </div>
        <div>
          <dd>{merchant.members.length}</dd>
          <dt>Anggota</dt>
        </div>
      </dl>

      {isOwner ? null : (
        <p className="dash-note">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M7 6.25v3.5M7 4.25v.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Hanya pemilik toko yang bisa mengubah profil dan anggota.
        </p>
      )}
    </section>
  )
}

function MembersCard({ merchant, isOwner, onChange, onForbidden }: Props) {
  const { token } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = identifier.trim()

    if (!value) {
      setError('Isi email atau username anggota baru')
      return
    }

    if (!token) return

    setAdding(true)
    setError(null)

    try {
      onChange(await addMerchantMember(merchant, value, token))
      setIdentifier('')
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 403) {
        onForbidden()
        return
      }
      setError(
        failure instanceof ApiError && failure.status === 404
          ? 'Pengguna tidak ditemukan'
          : toErrorMessage(failure),
      )
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (member: MerchantMember) => {
    if (!token) return

    setRemoving(member.userId)
    setError(null)

    try {
      onChange(await removeMerchantMember(merchant, member.userId, token))
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 403) {
        onForbidden()
        return
      }
      setError(toErrorMessage(failure))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section className="dash-card" aria-labelledby="members-title">
      <div className="dash-card__head">
        <h2 className="dash-card__title" id="members-title">
          Anggota toko
        </h2>
        <p className="dash-card__meta">{merchant.members.length} orang</p>
      </div>

      {isOwner ? (
        <form className="dash-add" onSubmit={handleAdd} noValidate>
          <div className="ui-field dash-add__field">
            <input
              className={error ? 'ui-input ui-input--invalid' : 'ui-input'}
              aria-label="Email atau username anggota baru"
              placeholder="Email atau username anggota baru"
              value={identifier}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'member-error' : undefined}
              onChange={(event) => setIdentifier(event.target.value)}
            />
            {error ? (
              <p className="ui-error" id="member-error" role="alert">
                <img src={alertIcon} alt="" width={14} height={14} />
                {error}
              </p>
            ) : null}
          </div>
          <button className="ui-btn ui-btn--primary" type="submit" disabled={adding}>
            <img src={plusIcon} alt="" width={18} height={18} />
            {adding ? 'Menambah…' : 'Tambah'}
          </button>
        </form>
      ) : null}

      <ul className="dash-members">
        {merchant.members.map((member) => (
          <li className="dash-member" key={member.userId}>
            <span className="dash-member__avatar" aria-hidden="true">
              {initialsOf(member.name)}
            </span>
            <span className="dash-member__text">
              <span className="dash-member__name">{member.name}</span>
              {member.email ? <span className="dash-member__email">{member.email}</span> : null}
            </span>
            <span className="dash-member__role">
              <span className={member.role === 'OWNER' ? 'ui-badge ui-badge--dark' : 'ui-badge'}>
                {member.role === 'OWNER' ? 'Pemilik' : 'Anggota'}
              </span>
            </span>
            {isOwner ? (
              <span className="dash-member__action">
                {member.role === 'OWNER' ? null : (
                  <button
                    className="ui-btn ui-btn--text ui-btn--sm"
                    type="button"
                    disabled={removing === member.userId}
                    aria-label={`Keluarkan ${member.name}`}
                    onClick={() => void handleRemove(member)}
                  >
                    <img src={trashIcon} alt="" width={16} height={16} />
                    Keluarkan
                  </button>
                )}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StoreProfileSection
