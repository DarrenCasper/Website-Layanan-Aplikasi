import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useResetForm } from '../context/resetFormContext'
import { requestPasswordReset, toErrorMessage } from '../lib/api'
import forgetHero from '../assets/forget-hero.jpg'

function ForgetPasswordPage() {
  const navigate = useNavigate()
  const { values, setEmail } = useResetForm()

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const email = values.email.trim()

    if (email === '') {
      setError('Email wajib diisi.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      // The backend always answers generically here so accounts cannot be
      // probed, so there is nothing to branch on. The next page is where the
      // code is actually entered and checked.
      await requestPasswordReset({ email })
      navigate('/forget/otp')
    } catch (caught) {
      setError(toErrorMessage(caught))
      setIsSubmitting(false)
    }
  }

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
  }

  return (
    <AuthLayout
      hero={forgetHero}
      footer={
        <>
          <span className="auth__footer-text">Kembali ke</span>
          <Link className="auth__link" to="/login">
            Login
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
        <h1 className="auth__title">Lupa Password</h1>
        <p className="auth__subtitle">Jangan khawatir, proses mudah</p>
      </div>

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="forget-email">
            Email address
          </label>
          <input
            className="auth__input"
            id="forget-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Masukkan emailmu"
            value={values.email}
            onChange={handleEmailChange}
          />
        </div>

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses...' : 'Rubah password'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default ForgetPasswordPage
