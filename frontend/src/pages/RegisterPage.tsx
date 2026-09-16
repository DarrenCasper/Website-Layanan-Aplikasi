import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useRegisterForm } from '../context/registerFormContext'
import registerHero from '../assets/register-hero.jpg'

function RegisterPage() {
  const navigate = useNavigate()
  const { values, setField } = useRegisterForm()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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

        <button className="auth__submit" type="submit">
          Next ->
        </button>
      </form>
    </AuthLayout>
  )
}

export default RegisterPage
