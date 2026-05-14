import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MonitorPlay, UtensilsCrossed, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks/useSession'
import { useAdminRestaurant } from '../hooks/useAdminRestaurant'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import { SupportPage } from './SupportPage'
import { OverviewPage } from './OverviewPage'
import { MenuPage } from './MenuPage'
import { SettingsPage } from './SettingsPage'
import { OrdersPage } from './OrdersPage'
import { AssistantPage } from './AssistantPage'
import { PlansPage } from './PlansPage'
import { TablesPage } from './TablesPage'

type AdminPage = 'overview' | 'menu' | 'settings' | 'orders' | 'assistant' | 'plans' | 'tables' | 'support'

const NAV: { id: AdminPage; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'menu',     label: 'Menu'     },
  { id: 'plans',    label: 'Plans'    },
  { id: 'settings', label: 'Settings' },
]

const NAV_INSIGHTS: { id: AdminPage; label: string }[] = [
  { id: 'orders',    label: 'Orders'    },
  { id: 'tables',    label: 'Tables'    },
  { id: 'assistant', label: 'Assistant' },
]

const GUEST_MENU_DEFAULT_TABLE_PARAM = '1'

function SuspendedBanner() {
  return (
    <div className="mb-6 rounded-3 border border-ember/40 bg-ember-wash px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-ember shrink-0 mt-1.5" />
          <div>
            <p className="font-semibold text-ember-2 text-body mb-0.5">This restaurant has been suspended</p>
            <p className="text-body-sm text-ink-5 leading-relaxed">
              Your account has been suspended by Mise and guests cannot place orders.
              Use the Support page to contact us and resolve the issue.
            </p>
          </div>
        </div>
        <NavLink
          to="/admin/support"
          className="shrink-0 px-4 py-2.5 rounded-2 bg-ember text-paper text-body-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap text-center no-underline"
        >
          Contact support
        </NavLink>
      </div>
    </div>
  )
}

function PausedBanner({ restaurant, userId }: { restaurant: AdminRestaurant; userId: string }) {
  const qc = useQueryClient()
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState('')

  async function resume() {
    setResuming(true)
    setError('')
    const { error: err } = await supabase
      .from('restaurants')
      .update({ accepting_orders: true })
      .eq('id', restaurant.id)
    if (err) {
      setError('Could not resume — try again.')
      setResuming(false)
      return
    }
    await qc.invalidateQueries({ queryKey: ['admin-restaurant', userId] })
    setResuming(false)
  }

  return (
    <div className="mb-6 rounded-3 border border-paper-4 bg-paper-2 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-ink-6 shrink-0" />
            <span className="font-semibold text-ink text-body">Ordering is paused</span>
          </div>
          <p className="text-body-sm text-ink-5">Guests cannot place new orders right now.</p>
          {error && <p className="text-body-sm text-ember mt-1">{error}</p>}
        </div>
        <button
          onClick={resume}
          disabled={resuming}
          className="shrink-0 px-4 py-2.5 rounded-2 bg-herb text-paper text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
        >
          {resuming ? 'Resuming…' : 'Resume ordering'}
        </button>
      </div>
    </div>
  )
}

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
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [supportUnread, setSupportUnread] = useState(0)

  // Close drawer whenever route changes
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Unread support messages — single subscription shared by sidebar + bottom nav
  useEffect(() => {
    if (!restaurant) return
    const rid = restaurant.id

    supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', rid)
      .eq('sender_role', 'platform')
      .is('read_at', null)
      .then(({ count }) => setSupportUnread(count ?? 0))

    const channel = supabase
      .channel(`support-badge-${rid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${rid}` }, (payload) => {
        if ((payload.new as { sender_role: string }).sender_role === 'platform') setSupportUnread(n => n + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${rid}` }, () => {
        supabase
          .from('support_messages')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid)
          .eq('sender_role', 'platform')
          .is('read_at', null)
          .then(({ count }) => setSupportUnread(count ?? 0))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id])

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

  const origin = window.location.origin

  // Sidebar / drawer nav body (shared between desktop sidebar and mobile drawer)
  function SidebarNav() {
    return (
      <>
        {/* Venue info */}
        <div className="px-4 pb-4 border-b border-paper-3 mb-2">
          <div className="font-display text-[17px] font-[500] text-ink font-optical">{restaurant!.name}</div>
          <div className="text-[11px] text-ink-6 mt-0.5">
            {window.location.host}/r/{restaurant!.slug}
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

        {/* Support */}
        <div className="px-4 pt-5 pb-1">
          <div className="text-overline text-ink-7 uppercase tracking-widest mb-1">Help</div>
        </div>
        <div className="px-2 space-y-0.5">
          <NavLink
            to="/admin/support"
            className={({ isActive }) =>
              `flex items-center justify-between px-2.5 py-2 rounded-2 text-body font-medium w-full text-left transition-colors duration-hover ${
                isActive ? 'bg-ink text-paper' : 'text-ink-5 hover:bg-paper-2 hover:text-ink'
              }`
            }
          >
            <span>Support</span>
            {supportUnread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ember text-paper text-[11px] font-semibold flex items-center justify-center tabular-nums">
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            )}
          </NavLink>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-paper-3 space-y-2">
          <a
            href={`${origin}/r/${restaurant!.slug}?table=${encodeURIComponent(GUEST_MENU_DEFAULT_TABLE_PARAM)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 text-left text-body-sm text-ink-6 hover:text-ink transition-colors duration-hover no-underline"
          >
            <UtensilsCrossed size={14} className="shrink-0" />
            Guest menu
          </a>
          <a
            href={`${origin}/kitchen`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 text-left text-body-sm text-ink-6 hover:text-ink transition-colors duration-hover no-underline"
          >
            <MonitorPlay size={14} className="shrink-0" />
            Kitchen display
          </a>
        </div>
      </>
    )
  }

  return (
    <div className="flex min-h-dvh min-w-0 w-full bg-paper">

      {/* ── Desktop sidebar (md+) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 bg-paper border-r border-paper-3 flex-col sticky top-0 h-dvh overflow-y-auto">
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
            Mise
          </span>
        </div>
        <SidebarNav />
      </aside>

      {/* ── Mobile top bar (< md) ─────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-paper border-b border-paper-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/logo-mark.svg"
            alt=""
            width={24}
            height={24}
            className="rounded-2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="font-display text-[16px] font-[500] text-ink tracking-[-0.01em] font-optical truncate max-w-[180px]">
            {restaurant.name}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center text-ink-5 hover:text-ink transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Mobile slide-out drawer ───────────────────────────────────────── */}
      <div className={`md:hidden fixed inset-0 z-50 ${mobileOpen ? '' : 'pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        {/* Drawer panel */}
        <div className={`absolute top-0 left-0 h-full w-[280px] bg-paper flex flex-col overflow-y-auto shadow-2 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-paper-3 mb-4">
            <div className="flex items-center gap-2">
              <img
                src="/assets/logo-mark.svg"
                alt=""
                width={24}
                height={24}
                className="rounded-2"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="font-display text-[17px] font-[500] text-ink tracking-[-0.01em] font-optical">Mise</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-ink-5 hover:text-ink transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          <SidebarNav />
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 px-4 pt-[72px] pb-6 md:px-9 md:py-7 md:pt-7 md:pb-7 max-w-[1200px] w-full">
        {restaurant.suspended
          ? <SuspendedBanner />
          : !restaurant.accepting_orders
          ? <PausedBanner restaurant={restaurant} userId={user!.id} />
          : null
        }
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview"  element={<OverviewPage  restaurant={restaurant} />} />
          <Route path="menu"      element={<MenuPage      restaurant={restaurant} />} />
          <Route path="plans"     element={<PlansPage     restaurant={restaurant} />} />
          <Route path="settings"  element={<SettingsPage  restaurant={restaurant} />} />
          <Route path="orders"    element={<OrdersPage    restaurant={restaurant} />} />
          <Route path="tables"    element={<TablesPage    restaurant={restaurant} />} />
          <Route path="assistant" element={<AssistantPage restaurant={restaurant} />} />
          <Route path="support"   element={<SupportPage   restaurant={restaurant} />} />
          <Route path="*"         element={<Navigate to="/admin/overview" replace />} />
        </Routes>
      </main>

    </div>
  )
}
