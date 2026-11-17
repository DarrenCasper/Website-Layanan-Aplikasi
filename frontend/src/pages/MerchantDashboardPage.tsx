import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StoreProfileSection from '../components/dashboard/StoreProfileSection'
import CatalogSection from '../components/dashboard/CatalogSection'
import { useAuth } from '../context/authContext'
import { ApiError, toErrorMessage } from '../lib/api'
import {
  createMerchant,
  fetchMyMerchant,
  fetchMyMerchants,
  NO_ACCESS_TOAST,
  initialsOf,
  type MerchantProfile,
} from '../lib/merchants'
import { CATALOG_BRAND, useDocumentTitle } from '../lib/useDocumentTitle'
import storeIcon from '../assets/icons/store-white.svg'
import storeLargeIcon from '../assets/icons/store-white-lg.svg'
import storeButtonIcon from '../assets/icons/store-white-btn.svg'
import boxIcon from '../assets/icons/box.svg'
import gridIcon from '../assets/icons/grid.svg'
import chevronIcon from '../assets/icons/chevron-dark.svg'
import alertIcon from '../assets/icons/alert.svg'
import '../styles/ui-controls.scss'
import './MerchantDashboardPage.scss'

type Section = 'profil' | 'katalog'

// Merchant dashboard (Figma #37). /toko-saya resolves to the user's store, or
// to "Buka toko" when they have none; /toko-saya/:id is the store profile and
// /toko-saya/:id/katalog the product and service list.
function MerchantDashboardPage() {
  const { merchantId, section: rawSection } = useParams<{ merchantId?: string; section?: string }>()
  const section: Section = rawSection === 'katalog' ? 'katalog' : 'profil'

  if (!merchantId) {
    return <DashboardEntry />
  }

  return <DashboardForStore key={merchantId} merchantId={merchantId} section={section} />
}

// --- /toko-saya -----------------------------------------------------------------

function DashboardEntry() {
  const { token, user } = useAuth()
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; merchants: MerchantProfile[] }
    | { status: 'error'; message: string }
  >({ status: 'loading' })

  useDocumentTitle(`Toko saya · ${CATALOG_BRAND}`)

  useEffect(() => {
    if (!token || !user) return

    let active = true
    fetchMyMerchants(token, user.id).then(
      (merchants) => active && setState({ status: 'ready', merchants }),
      (error: unknown) => active && setState({ status: 'error', message: toErrorMessage(error) }),
    )

    return () => {
      active = false
    }
  }, [token, user])

  if (state.status === 'ready' && state.merchants.length > 0) {
    return <Navigate to={`/toko-saya/${state.merchants[0].id}`} replace />
  }

  return (
    <main className="dash">
      <NavBar />
      <div className="dash__center">
        {state.status === 'loading' ? <p className="dash__muted">Memuat tokomu…</p> : null}
        {state.status === 'error' ? (
          <p className="dash__muted" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === 'ready' ? <OpenStoreCard /> : null}
      </div>
    </main>
  )
}

// "Buka toko" (Figma 97:7920).
const NAME_MIN = 3
const NAME_MAX = 50
const DESC_MAX = 500

function OpenStoreCard() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()

    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      setNameError(`Nama toko ${NAME_MIN} sampai ${NAME_MAX} karakter`)
      return
    }

    if (!token || !user) return

    setNameError(null)
    setFormError(null)
    setSubmitting(true)

    try {
      const merchant = await createMerchant(
        { namaToko: trimmed, deskripsi: description.trim() },
        token,
        { id: user.id, name: user.fullname, email: user.email },
      )
      navigate(`/toko-saya/${merchant.id}`, { replace: true })
    } catch (error) {
      const message = toErrorMessage(error)
      if (error instanceof ApiError && error.status < 500 && /nama|name/i.test(message)) {
        setNameError(message)
      } else {
        setFormError(message)
      }
      setSubmitting(false)
    }
  }

  return (
    <form className="open-store" onSubmit={handleSubmit} noValidate>
      <span className="open-store__icon" aria-hidden="true">
        <img src={storeLargeIcon} alt="" width={28} height={28} />
      </span>

      <div className="open-store__intro">
        <h1 className="open-store__title">Buka tokomu</h1>
        <p className="open-store__text">
          Kamu belum punya toko. Isi nama toko dan deskripsi singkat, lalu mulai jual barang atau
          jasa ke sesama warga kampus.
        </p>
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="open-store-name">
          Nama toko <span className="ui-required">*</span>
        </label>
        <input
          id="open-store-name"
          className={nameError ? 'ui-input ui-input--invalid' : 'ui-input'}
          placeholder="Contoh: Lab Komputer B201"
          maxLength={NAME_MAX}
          value={name}
          aria-invalid={Boolean(nameError)}
          aria-describedby="open-store-name-help"
          onChange={(event) => setName(event.target.value)}
        />
        {nameError ? (
          <p className="ui-error" id="open-store-name-help" role="alert">
            <img src={alertIcon} alt="" width={14} height={14} />
            {nameError}
          </p>
        ) : (
          <p className="ui-help" id="open-store-name-help">
            {NAME_MIN} sampai {NAME_MAX} karakter
          </p>
        )}
      </div>

      <div className="ui-field">
        <label className="ui-label" htmlFor="open-store-desc">
          Deskripsi <span className="ui-optional">(opsional)</span>
        </label>
        <textarea
          id="open-store-desc"
          className="ui-input ui-textarea"
          placeholder="Ceritakan apa yang kamu jual"
          maxLength={DESC_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="ui-help">Maks. {DESC_MAX} karakter</p>
      </div>

      {formError ? (
        <p className="ui-error" role="alert">
          <img src={alertIcon} alt="" width={14} height={14} />
          {formError}
        </p>
      ) : null}

      <button className="ui-btn ui-btn--primary ui-btn--block" type="submit" disabled={submitting}>
        <img src={storeButtonIcon} alt="" width={18} height={18} />
        {submitting ? 'Membuka toko…' : 'Buka toko'}
      </button>
    </form>
  )
}

// --- /toko-saya/:merchantId -------------------------------------------------------

function DashboardForStore({ merchantId, section }: { merchantId: string; section: Section }) {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useDocumentTitle(`${merchant?.namaToko ?? 'Toko saya'} · ${CATALOG_BRAND}`)

  // A non-member, or a 403 from any dashboard call, leaves for Explore with a
  // short explanation (Figma note on 97:9557).
  const denyAccess = useCallback(() => {
    navigate('/', { replace: true, state: { toast: NO_ACCESS_TOAST } })
  }, [navigate])

  useEffect(() => {
    if (!token || !user) return

    let active = true
    fetchMyMerchant(merchantId, token, {
      id: user.id,
      name: user.fullname,
      email: user.email,
    }).then(
      (profile) => {
        if (!active) return
        if (!profile || !profile.members.some((member) => member.userId === user.id)) {
          denyAccess()
          return
        }
        setMerchant(profile)
      },
      (failure: unknown) => {
        if (!active) return
        if (failure instanceof ApiError && (failure.status === 403 || failure.status === 404)) {
          denyAccess()
          return
        }
        setError(toErrorMessage(failure))
      },
    )

    return () => {
      active = false
    }
  }, [merchantId, token, user, denyAccess])

  const role = merchant?.members.find((member) => member.userId === user?.id)?.role ?? 'STAFF'
  const isOwner = role === 'OWNER'

  return (
    <main className="dash">
      <NavBar />

      {error ? (
        <div className="dash__center">
          <p className="dash__muted" role="alert">
            {error}
          </p>
        </div>
      ) : null}

      {!merchant && !error ? (
        <div className="dash__center">
          <p className="dash__muted">Memuat toko…</p>
        </div>
      ) : null}

      {merchant ? (
        <div className="dash__body">
          <aside className="dash-side" aria-label="Menu toko">
            <div className="dash-side__store">
              <span className="dash-side__avatar" aria-hidden="true">
                {initialsOf(merchant.namaToko)}
              </span>
              <div className="dash-side__store-text">
                <p className="dash-side__name">{merchant.namaToko}</p>
                <p className="dash-side__role">{isOwner ? 'Pemilik' : 'Anggota'}</p>
              </div>
            </div>

            <nav className="dash-side__nav">
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'dash-side__link dash-side__link--on' : 'dash-side__link'
                }
                to={`/toko-saya/${merchant.id}`}
                end
              >
                <img
                  className="dash-side__icon--light"
                  src={storeIcon}
                  alt=""
                  width={18}
                  height={18}
                />
                Profil toko
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'dash-side__link dash-side__link--on' : 'dash-side__link'
                }
                to={`/toko-saya/${merchant.id}/katalog`}
              >
                <img
                  className="dash-side__icon--dark"
                  src={boxIcon}
                  alt=""
                  width={18}
                  height={18}
                />
                Produk &amp; jasa
              </NavLink>
              <hr className="dash-side__sep" />
              <Link className="dash-side__link" to={`/merchant/${merchant.id}`}>
                <img src={gridIcon} alt="" width={18} height={18} />
                <span className="dash-side__grow">Lihat halaman toko</span>
                <img
                  className="dash-side__chevron"
                  src={chevronIcon}
                  alt=""
                  width={16}
                  height={16}
                />
              </Link>
            </nav>
          </aside>

          <div className="dash__main">
            {section === 'profil' ? (
              <StoreProfileSection
                merchant={merchant}
                isOwner={isOwner}
                onChange={setMerchant}
                onForbidden={denyAccess}
              />
            ) : (
              <CatalogSection merchant={merchant} onForbidden={denyAccess} />
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default MerchantDashboardPage
