import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthGuard } from './features/auth/components/AuthGuard'
import { SuperAdminGuard } from './features/platform/components/SuperAdminGuard'

const TokensPage = lazy(() => import('./pages/dev/TokensPage'))
const GuestMenuPage = lazy(() => import('./features/guest/pages/GuestMenuPage'))
const OrderStatusPage = lazy(() => import('./features/guest/pages/OrderStatusPage'))
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'))
const KitchenPage = lazy(() => import('./features/kitchen/pages/KitchenPage'))
const AdminShell = lazy(() => import('./features/admin/pages/AdminShell'))
const PlatformPage = lazy(() => import('./features/platform/pages/PlatformPage'))
const PlatformLoginPage = lazy(() => import('./features/platform/pages/PlatformLoginPage'))
const AdminEnterPage = lazy(() => import('./features/admin/pages/AdminEnterPage').then(m => ({ default: m.AdminEnterPage })))

const TABLECLOTH_BG = {
  backgroundImage: 'url(/assets/pattern-tablecloth.svg)',
  backgroundRepeat: 'repeat' as const,
}

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

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/platform/login" element={<PlatformLoginPage />} />

        {/* Kitchen — no login, opened from admin */}
        <Route path="/kitchen" element={<KitchenPage />} />

        {/* Platform admin impersonation entry — must be before the guarded /admin/* */}
        <Route path="/admin/enter" element={<AdminEnterPage />} />

        {/* Admin */}
        <Route
          path="/admin/*"
          element={
            <AuthGuard>
              <AdminShell />
            </AuthGuard>
          }
        />

        {/* Platform (super-admin only) */}
        <Route
          path="/platform"
          element={
            <SuperAdminGuard>
              <PlatformPage />
            </SuperAdminGuard>
          }
        />

        {/* Dev QA */}
        <Route path="/dev/tokens" element={<TokensPage />} />

        {/* Placeholder index */}
        <Route
          path="/"
          element={
            <div
              className="flex min-h-dvh items-center justify-center bg-paper"
              style={TABLECLOTH_BG}
            >
              <p className="font-display text-h1 text-ink font-optical">Mise</p>
            </div>
          }
        />
      </Routes>
    </Suspense>
  )
}
