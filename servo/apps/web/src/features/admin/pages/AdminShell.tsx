import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { LogOut, MonitorPlay } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/features/auth/hooks/useSession'
import { useAdminRestaurant } from '../hooks/useAdminRestaurant'
import { OverviewPage } from './OverviewPage'
import { MenuPage } from './MenuPage'
import { SettingsPage } from './SettingsPage'
import { OrdersPage } from './OrdersPage'
import { AssistantPage } from './AssistantPage'
import { PlansPage } from './PlansPage'

type AdminPage = 'overview' | 'menu' | 'settings' | 'orders' | 'assistant' | 'plans'

const NAV: { id: AdminPage; label: string }[] = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'menu',      label: 'Menu'      },
  { id: 'plans',     label: 'Plans'     },
  { id: 'settings',  label: 'Settings'  },
]

const NAV_INSIGHTS: { id: AdminPage; label: string }[] = [
  { id: 'orders',    label: 'Orders'    },
  { id: 'assistant', label: 'Assistant' },
]

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}

export default function AdminShell() {
  const { user } = useSession()
  const { data: restaurant, isLoading } = useAdminRestaurant(user?.id)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (isLoading) return <Spinner />

  if (!restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <p className="text-body text-ink-6">No restaurant assigned to your account.</p>
      </div>
    )
  }

  function NavItem({ id, label }: { id: AdminPage; label: string }) {
    return (
      <NavLink
        to={`/admin/${id}`}
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-2.5 py-2 rounded-2 text-body font-medium w-full text-left transition-colors duration-hover ${
            isActive ? 'bg-ink text-paper' : 'text-ink-5 hover:bg-paper-2 hover:text-ink'
          }`
        }
      >
        {label}
      </NavLink>
    )
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* Left nav */}
      <aside className="w-60 shrink-0 bg-paper border-r border-paper-3 flex flex-col sticky top-0 h-dvh overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-paper-3 mb-4">
          <img
            src="/assets/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            className="rounded-2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="font-display text-[18px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Servo
          </span>
        </div>

        {/* Venue info */}
        <div className="px-4 pb-4 border-b border-paper-3 mb-2">
          <div className="font-display text-[17px] font-[500] text-ink font-optical">{restaurant.name}</div>
          <div className="text-[11px] text-ink-6 mt-0.5">
            {window.location.host}/r/{restaurant.slug}
          </div>
        </div>

        {/* Manage group */}
        <div className="px-4 pt-3 pb-1">
          <div className="text-overline text-ink-7 uppercase tracking-widest mb-1">Manage</div>
        </div>
        <div className="px-2 space-y-0.5">
          {NAV.map(n => <NavItem key={n.id} {...n} />)}
        </div>

        {/* Insights group */}
        <div className="px-4 pt-5 pb-1">
          <div className="text-overline text-ink-7 uppercase tracking-widest mb-1">Insights</div>
        </div>
        <div className="px-2 space-y-0.5">
          {NAV_INSIGHTS.map(n => <NavItem key={n.id} {...n} />)}
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-paper-3 space-y-2">
          <a
            href="/kitchen"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-body-sm text-ink-6 hover:text-ink transition-colors duration-hover"
          >
            <MonitorPlay size={14} />
            Kitchen display
          </a>
          <div className="text-[12px] text-ink-6 truncate">{user?.email}</div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-body-sm text-ink-6 hover:text-ink transition-colors duration-hover"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — nested routes so refresh keeps the current section */}
      <main className="flex-1 px-9 py-7 max-w-[1200px]">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage restaurant={restaurant} />} />
          <Route path="menu" element={<MenuPage restaurant={restaurant} />} />
          <Route path="plans" element={<PlansPage restaurant={restaurant} />} />
          <Route path="settings" element={<SettingsPage restaurant={restaurant} />} />
          <Route path="orders" element={<OrdersPage restaurant={restaurant} />} />
          <Route path="assistant" element={<AssistantPage restaurant={restaurant} />} />
          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Routes>
      </main>
    </div>
  )
}
