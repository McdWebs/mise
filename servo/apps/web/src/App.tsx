import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthGuard } from './features/auth/components/AuthGuard'

const TokensPage = lazy(() => import('./pages/dev/TokensPage'))
const GuestMenuPage = lazy(() => import('./features/guest/pages/GuestMenuPage'))
const OrderStatusPage = lazy(() => import('./features/guest/pages/OrderStatusPage'))
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'))
const KitchenPage = lazy(() => import('./features/kitchen/pages/KitchenPage'))

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Guest ordering */}
        <Route path="/r/:slug" element={<GuestMenuPage />} />
        <Route path="/r/:slug/order/:orderId" element={<OrderStatusPage />} />

        {/* Kitchen */}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/kitchen"
          element={
            <AuthGuard>
              <KitchenPage />
            </AuthGuard>
          }
        />

        {/* Dev QA */}
        <Route path="/dev/tokens" element={<TokensPage />} />

        {/* Placeholder index */}
        <Route
          path="/"
          element={
            <div className="flex min-h-dvh items-center justify-center bg-paper">
              <p className="font-display text-h1 text-ink font-optical">Servo</p>
            </div>
          }
        />
      </Routes>
    </Suspense>
  )
}
