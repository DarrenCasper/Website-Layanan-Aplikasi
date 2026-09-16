import type { ReactNode } from 'react'
import './AuthLayout.scss'

type AuthLayoutProps = {
  /** Hero photo shown in the right-hand art panel. */
  hero: string
  /** Heading and form for the screen. */
  children: ReactNode
  /** Footer links under the form. */
  footer: ReactNode
}

// Shared 1920x1080 auth shell: wave-pattern backdrop, centred form column with
// the Temu brand above and the footer links below, and the hero photo on the
// right. Every auth screen renders through this component.
function AuthLayout({ hero, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__content">
          <header className="auth__brand">
            <span className="auth__mark" aria-hidden="true" />
            <p className="auth__wordmark">Temu</p>
          </header>

          <div className="auth__main">{children}</div>

          <footer className="auth__footer">{footer}</footer>
        </div>
      </div>

      <aside className="auth__art">
        <img className="auth__art-image" src={hero} alt="" />
      </aside>
    </div>
  )
}

export default AuthLayout
