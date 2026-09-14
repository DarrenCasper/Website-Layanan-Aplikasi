import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useRegisterForm } from '../context/registerFormContext'
import registerHero from '../assets/register-hero.jpg'

function RegisterStageTwoPage() {
  const { values, setField } = useRegisterForm()

  const fullName = values.fullName.trim()
  const hasFaculty = values.faculty.trim() !== ''

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const handleFacultyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setField('faculty', value)

    // The department field is gated behind the faculty field, so emptying the
    // faculty drops any department answer rather than leaving a stale value
    // behind an input the user can no longer see the source of.
    if (value.trim() === '') {
      setField('department', '')
    }
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
        <h1 className="auth__title">{fullName ? `Good evening, ${fullName}` : 'Good evening'}</h1>
      </div>

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="register-faculty">
            Apa fakultasmu?
          </label>
          <input
            className="auth__input"
            id="register-faculty"
            name="faculty"
            type="text"
            autoComplete="organization"
            placeholder="Masukkan nama fakultas"
            value={values.faculty}
            onChange={handleFacultyChange}
          />
        </div>

        <div className="auth__field">
          <label className="auth__label" htmlFor="register-department">
            Apa departemenmu?
          </label>
          <input
            className="auth__input"
            id="register-department"
            name="department"
            type="text"
            autoComplete="organization-title"
            placeholder={hasFaculty ? 'Masukkan nama departemen' : 'Isi fakultas dulu'}
            value={values.department}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setField('department', event.target.value)
            }
            disabled={!hasFaculty}
          />
        </div>

        <button className="auth__submit" type="submit">
          Register
        </button>
      </form>
    </AuthLayout>
  )
}

export default RegisterStageTwoPage
