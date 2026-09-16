import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import loginHero from '../assets/login-hero.jpg'

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
    <AuthLayout
      hero={loginHero}
      footer={
        <>
          <Link className="auth__link" to="/forget">
            Lupa Password?
          </Link>
          <span className="auth__divider" aria-hidden="true" />
          <span className="auth__footer-text">Belum punya akun?</span>
          <Link className="auth__link" to="/register">
            Register
          </Link>
        </>
      }
    >
      <div className="auth__heading">
        <h1 className="auth__title">Welcome Back</h1>
        <p className="auth__subtitle">Temukan barang impianmu</p>
      </div>

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="login-email">
            Email address
          </label>
          <input
            className="auth__input"
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Masukkan alamat email"
            value={email}
            onChange={handleEmailChange}
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="login-password">
            Password
          </label>
          <input
            className="auth__input"
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Masukkan password"
            value={password}
            onChange={handlePasswordChange}
          />
        </div>

        <button className="auth__submit" type="submit">
          Login
        </button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
