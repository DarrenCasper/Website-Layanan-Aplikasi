import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import RegisterFormProvider from './context/RegisterFormProvider'
import RequireAuth from './components/RequireAuth'
import ExplorePage from './pages/ExplorePage'
import ProductDetailPage from './pages/ProductDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RegisterStageTwoPage from './pages/RegisterStageTwoPage'
import EmailOtpPage from './pages/EmailOtpPage'
import ForgetPasswordPage from './pages/ForgetPasswordPage'
import ResetFormProvider from './context/ResetFormProvider'

function App() {
  return (
    <Routes>
      {/* Catalog screens. Login and register both redirect here on success. */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <ExplorePage />
          </RequireAuth>
        }
      />
      <Route
        path="/product/:id"
        element={
          <RequireAuth>
            <ProductDetailPage />
          </RequireAuth>
        }
      />

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
