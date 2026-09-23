import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useRegisterForm } from '../context/registerFormContext'
import { ITS_STUDENT_EMAIL_DOMAIN } from '../lib/api'
import registerHero from '../assets/register-hero.jpg'

function RegisterPage() {
  const navigate = useNavigate()
  const { values, setField } = useRegisterForm()
  const [error, setError] = useState('')

  // Stage 1 only collects and checks input. The account is created in stage 2,
  // because the backend needs the faculty and department in the same request.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const fullName = values.fullName.trim()
    const email = values.email.trim()
    const username = values.username.trim()

    if (fullName === '' || email === '' || values.password === '' || username === '') {
      setError('Semua kolom wajib diisi.')
      return
    }

    if (!email.endsWith(ITS_STUDENT_EMAIL_DOMAIN)) {
      setError(`Email harus menggunakan alamat ITS (${ITS_STUDENT_EMAIL_DOMAIN}).`)
      return
    }

    setError('')
    navigate('/register/step-2')
  }

  return (
    <AuthLayout
      hero={registerHero}
      footer={
        <>
          <span className="auth__footer-text">Sudah punya akun?</span>
          <Link className="auth__link" to="/login">
            Login
          </Link>
        </>
      }
    >
      <div className="auth__heading">
        <h1 className="auth__title">Good evening</h1>
      </div>

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="register-full-name">
            Nama Lengkap
          </label>
          <input
            className="auth__input"
            id="register-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Masukkan nama lengkap"
            value={values.fullName}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setField('fullName', event.target.value)
            }
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="register-email">
            Email
          </label>
          <input
            className="auth__input"
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Masukkan alamat email"
            value={values.email}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setField('email', event.target.value)
            }
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="register-password">
            Password
          </label>
          <input
            className="auth__input"
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Masukkan password"
            value={values.password}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setField('password', event.target.value)
            }
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="register-username">
            Username
          </label>
          <input
            className="auth__input"
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Masukkan usernamemu"
            value={values.username}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setField('username', event.target.value)
            }
          />
        </div>

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth__submit" type="submit">
          Next {'->'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default RegisterPage
