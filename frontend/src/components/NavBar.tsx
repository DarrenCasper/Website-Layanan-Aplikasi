import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import searchIcon from '../assets/catalog/icon-search.svg'
import './NavBar.scss'

const SEARCH_PLACEHOLDER = 'Cari barang yang kamu mau'

type NavBarProps = {
  /** Current search text. Omit together with `onSearchChange` for a read-only bar. */
  searchValue?: string
  onSearchChange?: (value: string) => void
  /** Called when the user presses Enter in the search field. */
  onSearchSubmit?: () => void
}

// Pagi before 11:00, Siang until 15:00, Sore until 18:30, Malam after that.
function timeOfDayGreeting(date: Date): string {
  const minutes = date.getHours() * 60 + date.getMinutes()

  if (minutes < 11 * 60) {
    return 'Pagi'
  }

  if (minutes < 15 * 60) {
    return 'Siang'
  }

  if (minutes < 18 * 60 + 30) {
    return 'Sore'
  }

  return 'Malam'
}

// The sticky bar both catalog screens share: brand mark, search field and the
// signed-in greeting, which doubles as the logout menu. The greeting is a
// button so the session can be ended from either page, but it is styled to look
// exactly like the plain text the design shows until it is clicked.
function NavBar({ searchValue, onSearchChange, onSearchSubmit }: NavBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  const isSearchEditable = onSearchChange !== undefined

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(event.target.value)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearchSubmit?.()
    }
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    logout()
    // replace keeps the back button from returning to a page the session can no
    // longer open.
    navigate('/login', { replace: true })
  }

  const firstName = user?.fullname.trim().split(/\s+/)[0] ?? 'Pengguna'
  const greeting = `${timeOfDayGreeting(new Date())}, ${firstName}`

  return (
    <div className="navbar">
      <nav className="navbar__bar">
        <Link className="navbar__brand" to="/">
          <span className="navbar__mark" aria-hidden="true" />
          <span className="navbar__wordmark">Temu</span>
        </Link>

        <div className="navbar__search">
          <div className="navbar__search-field">
            <img className="navbar__search-icon" src={searchIcon} alt="" aria-hidden="true" />
            {isSearchEditable ? (
              <input
                className="navbar__search-input"
                type="search"
                aria-label="Cari barang"
                placeholder={SEARCH_PLACEHOLDER}
                value={searchValue ?? ''}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
            ) : (
              <span className="navbar__search-placeholder">{SEARCH_PLACEHOLDER}</span>
            )}
          </div>
        </div>

        <div className="navbar__account" ref={accountRef}>
          <button
            className="navbar__greeting"
            type="button"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {greeting}
          </button>

          {isMenuOpen ? (
            <div className="navbar__menu" role="menu">
              <button
                className="navbar__menu-item"
                type="button"
                role="menuitem"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </div>
  )
}

export default NavBar
