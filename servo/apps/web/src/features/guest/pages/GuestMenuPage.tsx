import { useState, useRef, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, BellRing, Check } from 'lucide-react'
import { useRestaurant } from '../hooks/useRestaurant'
import { useMenu } from '../hooks/useMenu'
import { useCartStore } from '../store/cartStore'
import { submitOrder } from '../submit'
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
import type { MenuItem } from '@servo/types'

type Screen = 'cover' | 'menu'

export default function GuestMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tableLabel = searchParams.get('table') ?? 'T 1'

  const [screen, setScreen] = useState<Screen>('cover')
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [showWaiterToast, setShowWaiterToast] = useState(false)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const headerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  const { data: restaurant, isLoading: loadingRestaurant, error: restaurantError } = useRestaurant(slug ?? '')
  const { data: categories = [], isLoading: loadingMenu } = useMenu(restaurant?.id)

  const { data: plans = [] } = usePlans(restaurant?.id)
  const { addLine, getLines, getTotalCents, getTotalItems, clearCart } = useCartStore()
  const restaurantId = restaurant?.id ?? ''
  const lines = getLines(restaurantId)
  const totalCents = getTotalCents(restaurantId)
  const totalItems = getTotalItems(restaurantId)

  // Set initial active category once menu loads
  useEffect(() => {
    if (categories.length && !activeCatId) {
      setActiveCatId(categories[0].id)
    }
  }, [categories, activeCatId])

  // Scroll to section when category chip is picked, offsetting for sticky headers
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

  // Intersection observer — update active chip as user scrolls
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
      setSubmitError('Couldn\'t reach the kitchen. Your order is saved — tap to retry.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleCallWaiter() {
    if (waiterCalled) return
    setWaiterCalled(true)
    setShowWaiterToast(true)
    setTimeout(() => setShowWaiterToast(false), 3500)
    setTimeout(() => setWaiterCalled(false), 45_000)
  }

  if (loadingRestaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
      </div>
    )
  }

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

  if (screen === 'cover') {
    return (
      <div
        className="min-h-dvh bg-paper"
        style={{ backgroundImage: 'url(/assets/pattern-tablecloth.svg)', backgroundRepeat: 'repeat' }}
      >
        <div className="w-full max-w-[420px] mx-auto">
          <CoverScreen
            restaurant={restaurant}
            tableLabel={tableLabel}
            onEnter={() => setScreen('menu')}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative min-h-dvh bg-paper"
      style={{ backgroundImage: 'url(/assets/pattern-tablecloth.svg)', backgroundRepeat: 'repeat' }}
    >
      <div className="w-full max-w-[420px] mx-auto">
        <div ref={headerRef}>
          <VenueHeader restaurant={restaurant} tableLabel={tableLabel} />
        </div>

        <div ref={navRef}>
          <CategoryNav
            categories={categories}
            activeId={activeCatId}
            onPick={handleCatPick}
          />
        </div>

        {/* Plans */}
        <PlansSection
          plans={plans}
          currency={restaurant.currency}
          onAddPlan={plan =>
            addLine(restaurantId, {
              kind: 'plan',
              planId: plan.id,
              name: plan.title,
              unitPriceCents: plan.price_cents,
              detailLines: [...plan.includes],
              modifiers: [],
            })
          }
        />

        {/* Menu sections */}
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
      </div>

      {/* Sticky cart bar */}
      <CartBar
        itemCount={totalItems}
        totalCents={totalCents}
        currency={restaurant.currency}
        onOpen={() => setCartOpen(true)}
      />

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

      {/* Waiter called toast */}
      {showWaiterToast && (
        <div className="fixed bottom-[160px] left-1/2 -translate-x-1/2 z-50 bg-ink text-paper text-body-sm px-4 py-3 rounded-2 shadow-2 whitespace-nowrap animate-fade-in">
          Waiter on the way to {tableLabel}
        </div>
      )}

      {/* Sheets */}
      {openItem && (
        <ItemSheet
          item={openItem}
          currency={restaurant.currency}
          onClose={() => setOpenItem(null)}
          onAdd={line => addLine(restaurantId, line)}
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
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  )
}
