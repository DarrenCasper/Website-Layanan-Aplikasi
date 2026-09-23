import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { loginUser, toErrorMessage } from '../lib/api'
import { useAuth } from '../context/authContext'
import loginHero from '../assets/login-hero.jpg'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (email.trim() === '' || password === '') {
      setError('Email dan password wajib diisi.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const { token, user } = await loginUser({ email: email.trim(), password })
      login(token, user)
      // replace keeps the back button from returning to a form that has already
      // been used to sign in.
      navigate('/', { replace: true })
    } catch (caught) {
      setError(toErrorMessage(caught))
      setIsSubmitting(false)
    }
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

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses...' : 'Login'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
