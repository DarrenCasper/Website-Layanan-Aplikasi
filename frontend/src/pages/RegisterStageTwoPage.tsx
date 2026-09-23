import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useRegisterForm } from '../context/registerFormContext'
import { useAuth } from '../context/authContext'
import { registerUser, toErrorMessage } from '../lib/api'
import registerHero from '../assets/register-hero.jpg'

function RegisterStageTwoPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { values, setField } = useRegisterForm()

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fullName = values.fullName.trim()
  const hasFaculty = values.faculty.trim() !== ''

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const faculty = values.faculty.trim()
    const department = values.department.trim()

    if (faculty === '' || department === '') {
      setError('Fakultas dan departemen wajib diisi.')
      return
    }

    // Reaching this page without stage 1 data (a direct link, or a reload) would
    // send the backend a request it can only reject, so say so plainly instead.
    if (
      fullName === '' ||
      values.email.trim() === '' ||
      values.password === '' ||
      values.username.trim() === ''
    ) {
      setError('Data langkah pertama belum lengkap. Kembali ke langkah sebelumnya.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      // The backend field names differ from the form's own names for three of the
      // six values, so the mapping is spelled out rather than spread.
      const { token, user } = await registerUser({
        email: values.email.trim(),
        password: values.password,
        fullname: fullName,
        username: values.username.trim(),
        department,
        fakultas: faculty,
      })

      login(token, user)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(toErrorMessage(caught))
      setIsSubmitting(false)
    }
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

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses...' : 'Register'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default RegisterStageTwoPage
