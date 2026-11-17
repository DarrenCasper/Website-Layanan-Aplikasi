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
import StorefrontPage from './pages/StorefrontPage'
import MerchantDashboardPage from './pages/MerchantDashboardPage'
import ChatWidget from './components/chat/ChatWidget'

function App() {
  return (
    <>
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

        {/* Public storefront (#38). Chatting with the store asks for a login. */}
        <Route path="/merchant/:merchantId" element={<StorefrontPage />} />

        {/* Merchant dashboard (#37). /toko-saya picks the user's store or offers
          to open one; the section is the last path segment. */}
        <Route
          path="/toko-saya/:merchantId?/:section?"
          element={
            <RequireAuth>
              <MerchantDashboardPage />
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

      {/* The chat launcher floats over every page for signed-in users (#40). */}
      <ChatWidget />
    </>
  )
}

export default App
