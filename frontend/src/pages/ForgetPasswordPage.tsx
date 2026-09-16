import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import forgetHero from '../assets/forget-hero.jpg'

function ForgetPasswordPage() {
  const [email, setEmail] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
            value={email}
            onChange={handleEmailChange}
          />
        </div>

        <button className="auth__submit" type="submit">
          Rubah password
        </button>
      </form>
    </AuthLayout>
  )
}

export default ForgetPasswordPage
