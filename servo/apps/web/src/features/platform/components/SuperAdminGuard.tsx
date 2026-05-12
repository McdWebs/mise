import { Navigate } from 'react-router-dom'
import { useSuperAdmin } from '../hooks/useSuperAdmin'

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading, user } = useSuperAdmin()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="text-center">
          <p className="text-body text-ink font-semibold mb-1">Access denied</p>
          <p className="text-body-sm text-ink-6">This page requires platform admin access.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
