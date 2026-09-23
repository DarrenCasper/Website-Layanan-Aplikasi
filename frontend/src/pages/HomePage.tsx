import { useAuth } from '../context/authContext'
import './HomePage.scss'

function HomePage() {
  const { isAuthenticated, user, logout } = useAuth()

  // The logged-out view is the original placeholder, left exactly as it was.
  if (!isAuthenticated || !user) {
    return <h1>Hellow world</h1>
  }

  return (
    <main className="home">
      <p className="home__greeting">Halo, {user.fullname}</p>
      <p className="home__meta">{user.email}</p>
      <button className="home__logout" type="button" onClick={logout}>
        Logout
      </button>
    </main>
  )
}

export default HomePage
