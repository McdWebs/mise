import { useState, useRef, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
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

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const { data: restaurant, isLoading: loadingRestaurant, error: restaurantError } = useRestaurant(slug ?? '')
  const { data: categories = [], isLoading: loadingMenu } = useMenu(restaurant?.id)

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

  // Scroll to section when category chip is picked
  function handleCatPick(id: string) {
    setActiveCatId(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      <div className="w-full max-w-[420px] mx-auto border-x border-paper-3">
        <CoverScreen
          restaurant={restaurant}
          tableLabel={tableLabel}
          onEnter={() => setScreen('menu')}
        />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto border-x border-paper-3 relative min-h-dvh bg-paper">
      <VenueHeader restaurant={restaurant} tableLabel={tableLabel} />

      <CategoryNav
        categories={categories}
        activeId={activeCatId}
        onPick={handleCatPick}
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
                  <MenuItemRow key={item.id} item={item} onOpen={setOpenItem} />
                ))}
            </div>
          ))
        )}
      </div>

      {/* Sticky cart bar */}
      <CartBar
        itemCount={totalItems}
        totalCents={totalCents}
        onOpen={() => setCartOpen(true)}
      />

      {/* AI assistant FAB */}
      <button
        onClick={() => setAiOpen(true)}
        aria-label="Open menu assistant"
        className="fixed bottom-[92px] z-[7] border-2 border-paper w-[52px] h-[52px] rounded-full bg-ink text-paper flex items-center justify-center shadow-1 hover:bg-ink-2 transition-colors duration-hover"
        style={{ right: 'max(20px, calc(50vw - 210px + 20px))' }}
      >
        <MessageCircle size={22} />
        <span className="absolute -top-0.5 -right-0.5 bg-saffron text-paper font-mono text-[10px] font-bold rounded-pill px-1 py-px border-2 border-paper leading-none">
          AI
        </span>
      </button>

      {/* Sheets */}
      {openItem && (
        <ItemSheet
          item={openItem}
          onClose={() => setOpenItem(null)}
          onAdd={line => addLine(restaurantId, line)}
        />
      )}

      {cartOpen && (
        <CartSheet
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
