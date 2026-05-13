import { useState, useRef, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, BellRing, Check, ScanLine, PauseCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useRestaurant } from '../hooks/useRestaurant'
import { useMenu } from '../hooks/useMenu'
import { useGuestTable } from '../hooks/useGuestTable'
import { useCartStore } from '../store/cartStore'
import { submitOrder } from '../submit'
import { notifyKitchenFloorNudge } from '@/features/kitchen/liveChannel'
import { CoverScreen } from '../components/CoverScreen'
import { VenueHeader } from '../components/VenueHeader'
import { CategoryNav } from '../components/CategoryNav'
import { MenuItemRow } from '../components/MenuItemRow'
import { ItemSheet } from '../components/ItemSheet'
import { CartBar } from '../components/CartBar'
import { CartSheet } from '../components/CartSheet'
import { AssistantSheet } from '../components/AssistantSheet'
import { PlansSection } from '../components/PlansSection'
import { usePlans } from '../hooks/usePlans'
import { useTableOrders } from '../hooks/useTableOrders'
import type { RestaurantPlan } from '../hooks/usePlans'
import { PlanSheet } from '../components/PlanSheet'
import { TableOrdersSheet } from '../components/TableOrdersSheet'
import type { MenuItem } from '@servo/types'

const BG = { backgroundImage: 'url(/assets/pattern-tablecloth.svg)', backgroundRepeat: 'repeat' }

function guestCoverStorageKey(restaurantId: string, tableId: string, clearedAt: string | null) {
  // Include clearedAt so every table turnover gets a fresh cover gate
  return `servo:guest-cover-dismissed:${restaurantId}:${tableId}:${clearedAt ?? 'initial'}`
}

function isGuestCoverDismissed(restaurantId: string, tableId: string, clearedAt: string | null): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(guestCoverStorageKey(restaurantId, tableId, clearedAt)) === '1'
  } catch {
    return false
  }
}

function persistGuestCoverDismissed(restaurantId: string, tableId: string, clearedAt: string | null) {
  try {
    window.sessionStorage.setItem(guestCoverStorageKey(restaurantId, tableId, clearedAt), '1')
  } catch {
    // private mode / quota — guest can still continue this navigation
  }
}

export default function GuestMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Raw param — null means not provided
  const tableParam = searchParams.get('table')

  /** True after "Start ordering" this mount; sessionStorage handles remounts (e.g. Order more). */
  const [enteredMenuThisMount, setEnteredMenuThisMount] = useState(false)
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const [openPlan, setOpenPlan] = useState<RestaurantPlan | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [showWaiterToast, setShowWaiterToast] = useState(false)
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const headerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  const { data: restaurant, isLoading: loadingRestaurant, error: restaurantError } = useRestaurant(slug ?? '')
  const { data: guestTable, isLoading: loadingTable } = useGuestTable(restaurant?.id, tableParam)
  const { data: categories = [], isLoading: loadingMenu } = useMenu(restaurant?.id)
  const { data: plans = [] } = usePlans(restaurant?.id)
  const ordersTableLabel = guestTable?.label ?? tableParam
  // Only show orders placed since the last table clear (treats each turnover as a fresh session)
  const { data: tableOrders = [] } = useTableOrders(restaurant?.id, ordersTableLabel, guestTable?.cleared_at)

  const queryClient = useQueryClient()
  const { addLine, getLines, getTotalCents, getTotalItems, clearCart } = useCartStore()
  const restaurantId = restaurant?.id ?? ''
  // After validation, tableLabel is always the string from the confirmed table record
  const tableLabel = guestTable?.label ?? tableParam ?? ''
  const lines = getLines(restaurantId)
  const totalCents = getTotalCents(restaurantId)
  const totalItems = getTotalItems(restaurantId)

  useEffect(() => {
    if (categories.length && !activeCatId) {
      setActiveCatId(categories[0].id)
    }
  }, [categories, activeCatId])

  function handleCatPick(id: string) {
    setActiveCatId(id)
    const el = sectionRefs.current[id]
    if (!el) return
    const stickyOffset =
      (headerRef.current?.offsetHeight ?? 0) +
      (navRef.current?.offsetHeight ?? 0)
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  // Live-update accepting_orders so the paused screen appears/clears within seconds
  useEffect(() => {
    if (!restaurant?.id) return
    const ch = supabase
      .channel(`restaurant-accepting-${restaurant.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurant.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['restaurant', slug] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurant?.id, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!categories.length) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting)
        if (visible) setActiveCatId(visible.target.id.replace('section-', ''))
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    )
    Object.entries(sectionRefs.current).forEach(([, el]) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [categories])

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { orderId } = await submitOrder({ restaurantId, tableLabel, lines })
      clearCart(restaurantId)
      setCartOpen(false)
      navigate(`/r/${slug}/order/${orderId}?table=${encodeURIComponent(tableLabel)}`)
    } catch (err) {
      setSubmitError("Couldn't reach the kitchen. Your order is saved — tap to retry.")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleAddPlan(plan: RestaurantPlan) {
    addLine(restaurantId, {
      kind: 'plan',
      planId: plan.id,
      name: plan.title,
      unitPriceCents: plan.price_cents,
      detailLines: [...plan.includes],
      modifiers: [],
    })
  }

  const allMenuItems: MenuItem[] = categories.flatMap(cat => cat.menu_items)

  function getPlanIncludedItems(plan: RestaurantPlan) {
    return plan.includes.map(label => ({
      label,
      menuItem: allMenuItems.find(item => item.name === label),
    }))
  }

  function handleCallWaiter() {
    if (waiterCalled) return
    setWaiterCalled(true)
    setShowWaiterToast(true)
    setTimeout(() => setShowWaiterToast(false), 3500)
    setTimeout(() => setWaiterCalled(false), 45_000)
    if (!restaurantId) return
    void (async () => {
      const { error } = await supabase
        .from('waiter_calls')
        .insert({ restaurant_id: restaurantId, table_label: tableLabel })
      if (!error) notifyKitchenFloorNudge(restaurantId)
    })()
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loadingRestaurant || (restaurant && loadingTable)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
      </div>
    )
  }

  // ── Restaurant not found ───────────────────────────────────────────────────

  if (restaurantError || !restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-6 text-center">
        <div>
          <p className="font-display text-h2 text-ink mb-2 font-optical">Menu not found</p>
          <p className="text-body-sm text-ink-6">Check the link and try again.</p>
        </div>
      </div>
    )
  }

  // ── No table in URL ────────────────────────────────────────────────────────

  if (!tableParam) {
    return (
      <div className="min-h-dvh bg-paper" style={BG}>
        <div className="w-full max-w-[420px] mx-auto flex flex-col items-center justify-center min-h-dvh px-8 text-center">
          <ScanLine size={40} className="text-ink-5 mb-5" strokeWidth={1.5} />
          <p className="font-display text-[26px] font-[500] tracking-[-0.01em] text-ink leading-snug font-optical mb-2">
            Scan your table's QR code
          </p>
          <p className="text-[15px] text-ink-5 leading-relaxed">
            Use the code on your table to open the menu and place your order.
          </p>
        </div>
      </div>
    )
  }

  // ── Table param present but not found in this restaurant ───────────────────

  if (!guestTable) {
    return (
      <div className="min-h-dvh bg-paper" style={BG}>
        <div className="w-full max-w-[420px] mx-auto flex flex-col items-center justify-center min-h-dvh px-8 text-center">
          <ScanLine size={40} className="text-ink-5 mb-5" strokeWidth={1.5} />
          <p className="font-display text-[26px] font-[500] tracking-[-0.01em] text-ink leading-snug font-optical mb-2">
            Table not found
          </p>
          <p className="text-[15px] text-ink-5 leading-relaxed">
            This table doesn't exist on the menu. Ask your server for the correct QR code.
          </p>
        </div>
      </div>
    )
  }

  // ── Cover screen (once per browser session per table; clears when tab closes) ──

  const skipCover =
    enteredMenuThisMount ||
    isGuestCoverDismissed(restaurant.id, guestTable.id, guestTable.cleared_at)

  if (!skipCover) {
    return (
      <div className="min-h-dvh bg-paper" style={BG}>
        <div className="w-full max-w-[420px] mx-auto">
          <CoverScreen
            restaurant={restaurant}
            tableLabel={tableLabel}
            onEnter={() => {
              persistGuestCoverDismissed(restaurant.id, guestTable.id, guestTable.cleared_at)
              setEnteredMenuThisMount(true)
              void supabase.rpc('mark_table_occupied', {
                p_table_id: guestTable.id,
                p_restaurant_id: restaurant.id,
              })
            }}
          />
        </div>
      </div>
    )
  }

  // ── Orders paused ─────────────────────────────────────────────────────────

  if (!restaurant.accepting_orders || restaurant.suspended) {
    return (
      <div className="min-h-dvh bg-paper" style={BG}>
        <div className="w-full max-w-[420px] mx-auto flex flex-col items-center justify-center min-h-dvh px-8 text-center">
          <PauseCircle size={40} className="text-ink-5 mb-5" strokeWidth={1.5} />
          <p className="font-display text-[26px] font-[500] tracking-[-0.01em] text-ink leading-snug font-optical mb-2">
            Orders are paused
          </p>
          <p className="text-[15px] text-ink-5 leading-relaxed">
            {restaurant.name} isn't accepting new orders right now. Check back in a moment.
          </p>
        </div>
      </div>
    )
  }

  // ── Menu ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-dvh bg-paper" style={BG}>
      <div className="w-full max-w-[420px] mx-auto">
        <div ref={headerRef}>
          <VenueHeader
            restaurant={restaurant}
            tableLabel={tableLabel}
            onMyOrders={() => setOrdersSheetOpen(true)}
            orderCount={tableOrders.length}
          />
        </div>

        <div ref={navRef}>
          <CategoryNav
            categories={categories}
            activeId={activeCatId}
            onPick={handleCatPick}
          />
        </div>

        <PlansSection
          plans={plans}
          currency={restaurant.currency}
          onAddPlan={handleAddPlan}
          onOpenPlan={setOpenPlan}
        />

        <div className="pb-4">
          {loadingMenu ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
            </div>
          ) : (
            categories.map(cat => (
              <div
                key={cat.id}
                id={`section-${cat.id}`}
                ref={el => { sectionRefs.current[cat.id] = el }}
                className="px-5 pt-5 pb-2"
              >
                <h2 className="font-display text-[22px] font-[500] tracking-[-0.01em] text-ink mb-1 font-optical">
                  {cat.name}
                </h2>
                {cat.menu_items
                  .filter(item => item.available)
                  .map(item => (
                    <MenuItemRow key={item.id} item={item} currency={restaurant.currency} onOpen={setOpenItem} />
                  ))}
              </div>
            ))
          )}
        </div>

        <CartBar
          itemCount={totalItems}
          totalCents={totalCents}
          currency={restaurant.currency}
          onOpen={() => setCartOpen(true)}
        />
      </div>

      {/* Call waiter FAB */}
      <button
        onClick={handleCallWaiter}
        disabled={waiterCalled}
        aria-label="Call a waiter"
        className="fixed bottom-[92px] z-[7] border-2 border-ink w-[52px] h-[52px] rounded-full bg-paper text-ink flex items-center justify-center shadow-1 hover:bg-paper-2 transition-colors duration-hover disabled:opacity-60"
        style={{ left: 'max(20px, calc(50vw - 210px + 20px))' }}
      >
        {waiterCalled ? <Check size={20} /> : <BellRing size={20} />}
      </button>

      {/* AI assistant FAB */}
      <button
        onClick={() => setAiOpen(true)}
        aria-label="Open menu assistant"
        className="fixed bottom-[92px] z-[7] border-2 border-paper w-[52px] h-[52px] rounded-full bg-ink text-paper flex items-center justify-center shadow-1 hover:bg-ink-2 transition-colors duration-hover"
        style={{ right: 'max(20px, calc(50vw - 210px + 20px))' }}
      >
        <MessageCircle size={22} />
      </button>

      {showWaiterToast && (
        <div className="fixed bottom-[160px] left-1/2 -translate-x-1/2 z-50 bg-ink text-paper text-body-sm px-4 py-3 rounded-2 shadow-2 whitespace-nowrap animate-fade-in">
          Waiter on the way to {tableLabel}
        </div>
      )}

      {openItem && (
        <ItemSheet
          item={openItem}
          currency={restaurant.currency}
          onClose={() => setOpenItem(null)}
          onAdd={line => addLine(restaurantId, line)}
        />
      )}

      {openPlan && (
        <PlanSheet
          plan={openPlan}
          currency={restaurant.currency}
          includedItems={getPlanIncludedItems(openPlan)}
          onClose={() => setOpenPlan(null)}
          onAddPlan={plan => {
            handleAddPlan(plan)
            setOpenPlan(null)
          }}
        />
      )}

      {cartOpen && (
        <CartSheet
          restaurantId={restaurantId}
          currency={restaurant.currency}
          lines={lines}
          restaurantName={restaurant.name}
          tableLabel={tableLabel}
          onClose={() => { setCartOpen(false); setSubmitError(null) }}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {submitError && !cartOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ember text-paper text-body-sm px-4 py-3 rounded-2 shadow-2 max-w-[340px] text-center">
          {submitError}
        </div>
      )}

      {aiOpen && (
        <AssistantSheet
          restaurantId={restaurantId}
          restaurantName={restaurant.name}
          tableLabel={tableLabel}
          currency={restaurant.currency}
          onAddLine={line => addLine(restaurantId, line)}
          onClose={() => setAiOpen(false)}
        />
      )}

      {ordersSheetOpen && (
        <TableOrdersSheet
          slug={slug ?? ''}
          tableLabel={tableLabel}
          currency={restaurant.currency}
          orders={tableOrders}
          onClose={() => setOrdersSheetOpen(false)}
        />
      )}
    </div>
  )
}
