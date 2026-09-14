import { useState, type ChangeEvent, type FormEvent } from 'react'
import loginHero from '../assets/login-hero.jpg'
import './LoginPage.scss'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__content">
          <header className="login__brand">
            <span className="login__mark" aria-hidden="true" />
            <p className="login__wordmark">Temu</p>
          </header>

          <div className="login__main">
            <div className="login__heading">
              <h1 className="login__title">Welcome Back</h1>
              <p className="login__subtitle">Temukan barang impianmu</p>
            </div>

            <form className="login__form" noValidate onSubmit={handleSubmit}>
              <div className="login__field">
                <label className="login__label" htmlFor="login-email">
                  Email address
                </label>
                <input
                  className="login__input"
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Masukkan alamat email"
                  value={email}
                  onChange={handleEmailChange}
                />
              </div>

              <div className="login__field">
                <label className="login__label" htmlFor="login-password">
                  Password
                </label>
                <input
                  className="login__input"
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={handlePasswordChange}
                />
              </div>

              <button className="login__submit" type="submit">
                Login
              </button>
            </form>
          </div>

          <footer className="login__footer">
            <a className="login__link" href="#lupa-password">
              Lupa Password?
            </a>
            <span className="login__divider" aria-hidden="true" />
            <span className="login__footer-text">Belum punya akun?</span>
            <a className="login__link" href="#register">
              Register
            </a>
          </footer>
        </div>
      </div>

      <aside className="login__art">
        <img className="login__art-image" src={loginHero} alt="" />
      </aside>
    </div>
  )
}

export default LoginPage
