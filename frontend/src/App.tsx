import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import RegisterFormProvider from './context/RegisterFormProvider'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RegisterStageTwoPage from './pages/RegisterStageTwoPage'
import ForgetPasswordPage from './pages/ForgetPasswordPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forget" element={<ForgetPasswordPage />} />

      <Route
        element={
          <RegisterFormProvider>
            <Outlet />
          </RegisterFormProvider>
        }
      >
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/step-2" element={<RegisterStageTwoPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
