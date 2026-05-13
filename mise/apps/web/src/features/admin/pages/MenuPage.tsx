import { useEffect, useState } from 'react'
import { useAdminMenu } from '../hooks/useAdminMenu'
import { MenuCategoryList } from '../components/MenuCategoryList'
import { MenuItemTable } from '../components/MenuItemTable'
import { ItemEditDrawer } from '../components/ItemEditDrawer'
import { MenuImportModal } from '../components/MenuImportModal'
import { Sk } from '../components/Skeleton'
import type { AdminMenuCategory, AdminMenuItem } from '../hooks/useAdminMenu'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

interface MenuPageProps {
  restaurant: AdminRestaurant
}

export function MenuPage({ restaurant }: MenuPageProps) {
  const { data: fetchedCategories = [], isLoading } = useAdminMenu(restaurant.id)

  // Local state mirrors DB, updated optimistically for drag-reorder
  const [categories, setCategories] = useState<AdminMenuCategory[]>([])
  const [activeCatId, setActiveCatId] = useState<string>('')
  // Item drawer state: undefined=closed, null=new, AdminMenuItem=edit
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)

  // Sync from server
  useEffect(() => {
    if (fetchedCategories.length > 0) {
      setCategories(fetchedCategories)
      if (!activeCatId || !fetchedCategories.find(c => c.id === activeCatId)) {
        setActiveCatId(fetchedCategories[0].id)
      }
    }
  }, [fetchedCategories])

  if (isLoading) return <MenuSkeleton />

  const activeCategory = categories.find(c => c.id === activeCatId)
  const items = activeCategory?.menu_items ?? []

  function handleLocalItemReorder(sorted: AdminMenuItem[]) {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === activeCatId ? { ...cat, menu_items: sorted } : cat
      )
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">Menu</h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            Edit categories, items, prices, and availability.
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setImportOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2 border border-paper-4 bg-paper text-ink text-body font-semibold hover:bg-paper-2 transition-colors duration-hover"
          >
            Import from file
          </button>
          <button
            onClick={() => setEditingItem(null)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2 bg-saffron text-paper text-body font-semibold hover:bg-saffron-2 transition-colors duration-hover active:scale-[0.98] active:duration-press"
          >
            + New item
          </button>
        </div>
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:grid" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* Category list */}
          <MenuCategoryList
            categories={categories}
            activeCategoryId={activeCatId}
            onSelect={setActiveCatId}
            onLocalReorder={setCategories}
          />

          {/* Item table */}
          <div>
            {activeCategory ? (
              <MenuItemTable
                items={items}
                categories={categories}
                activeCategoryId={activeCatId}
                categoryName={activeCategory.name}
                currency={restaurant.currency}
                onEdit={item => setEditingItem(item)}
                onAdd={() => setEditingItem(null)}
                onLocalReorder={handleLocalItemReorder}
              />
            ) : (
              <p className="text-body-sm text-ink-6 py-4">Select a category.</p>
            )}
          </div>
        </div>
      </div>

      <ItemEditDrawer
        open={editingItem !== undefined}
        categoryId={activeCatId}
        categoryName={activeCategory?.name ?? ''}
        currency={restaurant.currency}
        item={editingItem ?? null}
        onClose={() => setEditingItem(undefined)}
      />

      {importOpen && (
        <MenuImportModal
          restaurantId={restaurant.id}
          existingCategories={categories}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  )
}

function MenuSkeleton() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div className="space-y-2">
          <Sk className="h-8 w-24" />
          <Sk className="h-4 w-72" />
        </div>
        <Sk className="h-10 w-28 rounded-2" />
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:grid" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* Category list */}
          <div className="space-y-1.5 sm:border-r sm:border-paper-3 sm:pr-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-9 w-full rounded-2" />
            ))}
          </div>

          {/* Item table */}
          <div>
            <div className="grid gap-4 pb-3 border-b border-paper-3 mb-1" style={{ gridTemplateColumns: '1fr 90px 80px 40px' }}>
              {['', '', '', ''].map((_, i) => <Sk key={i} className="h-3 w-full" />)}
            </div>
            <div className="space-y-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid gap-4 py-3 items-center" style={{ gridTemplateColumns: '1fr 90px 80px 40px' }}>
                  <div className="space-y-1.5">
                    <Sk className="h-4 w-3/4" />
                    <Sk className="h-3 w-1/2" />
                  </div>
                  <Sk className="h-4 w-16" />
                  <Sk className="h-6 w-12 rounded-pill" />
                  <Sk className="h-6 w-6 rounded-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
