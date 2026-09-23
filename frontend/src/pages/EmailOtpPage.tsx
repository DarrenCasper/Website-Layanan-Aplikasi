import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useResetForm } from '../context/resetFormContext'
import {
  RESET_PASSWORD_SUCCESS_MESSAGE,
  requestPasswordReset,
  resetPassword,
  toErrorMessage,
} from '../lib/api'
import forgetHero from '../assets/forget-hero.jpg'

function EmailOtpPage() {
  const navigate = useNavigate()
  const { values } = useResetForm()

  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const email = values.email.trim()

  // Without an email there is nothing to verify the code against, which happens
  // on a direct visit or a reload. Send the user back to the start rather than
  // rendering a form that can only fail.
  if (email === '') {
    return <Navigate to="/forget" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting || isResending) {
      return
    }

    const code = otp.trim()

    if (code === '' || newPassword === '') {
      setError('Kode OTP dan password baru wajib diisi.')
      return
    }

    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const { message } = await resetPassword({ email, otp: code, newPassword })

      // The backend answers 200 whether or not the OTP was accepted, so the
      // message is the only thing that separates success from rejection.
      if (message !== RESET_PASSWORD_SUCCESS_MESSAGE) {
        setError(message)
        setIsSubmitting(false)
        return
      }

      navigate('/login', { replace: true })
    } catch (caught) {
      setError(toErrorMessage(caught))
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (isSubmitting || isResending) {
      return
    }

    setError('')
    setNotice('')
    setIsResending(true)

    try {
      const { message } = await requestPasswordReset({ email })
      setNotice(message)
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setIsResending(false)
    }
  }

  const handleOtpChange = (event: ChangeEvent<HTMLInputElement>) => {
    // The code is digits only, so anything else the browser offers (paste with
    // spaces, for instance) is stripped before it reaches state.
    setOtp(event.target.value.replace(/\D/g, ''))
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewPassword(event.target.value)
  }

  const busy = isSubmitting || isResending

  return (
    <AuthLayout
      hero={forgetHero}
      footer={
        <>
          <span className="auth__footer-text">Kembali ke</span>
          <Link className="auth__link" to="/login">
            Login
          </Link>
        </>
      }
    >
      <div className="auth__heading">
        <h1 className="auth__title">Masukkan Kode OTP</h1>
        <p className="auth__subtitle">Kode dikirim ke {email}</p>
      </div>

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="otp-code">
            Kode OTP
          </label>
          <input
            className="auth__input"
            id="otp-code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Masukkan 6 digit kode"
            value={otp}
            onChange={handleOtpChange}
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="otp-new-password">
            Password Baru
          </label>
          <input
            className="auth__input"
            id="otp-new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Masukkan password baru"
            value={newPassword}
            onChange={handlePasswordChange}
          />
        </div>

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="auth__notice" role="status">
            {notice}
          </p>
        ) : null}

        <button className="auth__submit" type="submit" disabled={busy}>
          {isSubmitting ? 'Memproses...' : 'Rubah password'}
        </button>

        <button className="auth__resend" type="button" onClick={handleResend} disabled={busy}>
          {isResending ? 'Mengirim ulang...' : 'Kirim ulang kode'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default EmailOtpPage
