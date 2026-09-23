import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import RegisterFormProvider from './context/RegisterFormProvider'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RegisterStageTwoPage from './pages/RegisterStageTwoPage'
import EmailOtpPage from './pages/EmailOtpPage'
import ForgetPasswordPage from './pages/ForgetPasswordPage'
import ResetFormProvider from './context/ResetFormProvider'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ResetFormProvider>
            <Outlet />
          </ResetFormProvider>
        }
      >
        <Route path="/forget" element={<ForgetPasswordPage />} />
        <Route path="/forget/otp" element={<EmailOtpPage />} />
      </Route>

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
