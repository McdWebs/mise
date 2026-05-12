import { useState } from 'react'
import { Button } from '@servo/ui'
import { IconButton } from '@servo/ui'
import { Pill } from '@servo/ui'
import { Input } from '@servo/ui'
import { Textarea } from '@servo/ui'
import { Switch } from '@servo/ui'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@servo/ui'
import { Sheet } from '@servo/ui'
import { Drawer } from '@servo/ui'
import { DropdownMenu } from '@servo/ui'
import { ToastProvider, useToast } from '@servo/ui'
import { MoreHorizontal, Settings, Trash2, Copy, Star } from 'lucide-react'
import type { OrderStage } from '@servo/types'

const ORDER_STAGES: OrderStage[] = ['received', 'cooking', 'ready', 'picked_up', 'cancelled']

const COLORS = [
  { name: 'paper', hex: '#FAF6F0', label: 'Paper' },
  { name: 'paper-2', hex: '#F3ECE0', label: 'Paper 2' },
  { name: 'paper-3', hex: '#E8DFCF', label: 'Paper 3' },
  { name: 'paper-4', hex: '#D7CBB4', label: 'Paper 4' },
  { name: 'ink', hex: '#1A1612', label: 'Ink' },
  { name: 'ink-2', hex: '#2A241D', label: 'Ink 2' },
  { name: 'ink-3', hex: '#3B342B', label: 'Ink 3' },
  { name: 'ink-5', hex: '#6A5E51', label: 'Ink 5' },
  { name: 'ink-6', hex: '#837564', label: 'Ink 6' },
  { name: 'ink-7', hex: '#9A8C7A', label: 'Ink 7' },
  { name: 'ink-8', hex: '#C2B7A6', label: 'Ink 8' },
  { name: 'saffron', hex: '#D97706', label: 'Saffron (brand / received)' },
  { name: 'saffron-2', hex: '#B8620A', label: 'Saffron 2' },
  { name: 'saffron-3', hex: '#934B07', label: 'Saffron 3' },
  { name: 'saffron-wash', hex: '#FBEFD9', label: 'Saffron wash' },
  { name: 'honey', hex: '#C28A00', label: 'Honey (cooking)' },
  { name: 'honey-2', hex: '#9E7100', label: 'Honey 2' },
  { name: 'honey-wash', hex: '#F5E6B7', label: 'Honey wash' },
  { name: 'herb', hex: '#3F7A3A', label: 'Herb (ready)' },
  { name: 'herb-2', hex: '#2F5E2C', label: 'Herb 2' },
  { name: 'herb-wash', hex: '#DCEACE', label: 'Herb wash' },
  { name: 'ember', hex: '#B3321A', label: 'Ember (cancelled / error)' },
  { name: 'ember-2', hex: '#962815', label: 'Ember 2' },
  { name: 'ember-wash', hex: '#F7D9D3', label: 'Ember wash' },
  { name: 'steel', hex: '#2C5F7F', label: 'Steel (links / info)' },
  { name: 'steel-2', hex: '#224C66', label: 'Steel 2' },
  { name: 'steel-wash', hex: '#D6E2EA', label: 'Steel wash' },
]

const TYPE_SCALE = [
  { name: 'display-1', label: 'Display 1', className: 'font-display text-display-1 font-optical', sample: 'Bistro Calanque' },
  { name: 'display-2', label: 'Display 2', className: 'font-display text-display-2 font-optical', sample: 'Tonight\'s menu' },
  { name: 'h1', label: 'H1 / 30px', className: 'font-display text-h1 font-optical', sample: 'Wild Mushroom Tagliatelle' },
  { name: 'h2', label: 'H2 / 24px', className: 'font-sans text-h2 font-semibold', sample: 'Menu categories' },
  { name: 'h3', label: 'H3 / 20px', className: 'font-sans text-h3 font-semibold', sample: 'Order summary' },
  { name: 'body', label: 'Body / 16px', className: 'font-sans text-body', sample: 'A rich, earthy pasta with seasonal forest mushrooms, fresh thyme and parmesan cream.' },
  { name: 'body-sm', label: 'Body sm / 14px', className: 'font-sans text-body-sm', sample: 'Cooked to order. May contain traces of nuts.' },
  { name: 'label', label: 'Label / 13px', className: 'font-sans text-label font-medium', sample: 'Table 7 · 3 items' },
  { name: 'overline', label: 'Overline / 11px uppercase', className: 'font-sans text-overline uppercase tracking-[0.08em] text-ink-6', sample: 'Starters' },
  { name: 'mono', label: 'Mono / 13px tabular', className: 'font-mono text-mono tnum', sample: '€12.50 · 04:32 · #A1B3' },
]

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 56, 80]
const RADII = [
  { name: 'none (kitchen tickets)', value: '0px' },
  { name: '1 / 4px (tags)', value: '4px' },
  { name: '2 / 8px (buttons, fields)', value: '8px' },
  { name: '3 / 12px (cards, modals)', value: '12px' },
  { name: 'pill / 999px (status pills)', value: '999px' },
]

function ToastDemo() {
  const { toast } = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => toast('Order sent to the kitchen.')}>Default</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Order ready for pickup.', { variant: 'success' })}>Success</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Couldn\'t reach the kitchen. Your order is saved — tap to retry.', { variant: 'error' })}>Error</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Table 7 has been waiting 12 minutes.', { variant: 'warning' })}>Warning</Button>
    </div>
  )
}

export default function TokensPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(true)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-paper">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-paper border-b border-paper-3 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-h2 text-ink font-optical">Servo — design tokens</h1>
            <p className="text-body-sm text-ink-6">Visual QA for Phase 1</p>
          </div>
          <img src="/assets/logo-wordmark.svg" alt="Servo" className="h-7" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>

        <div className="max-w-5xl mx-auto px-8 py-14 space-y-20">

          {/* ── Colors ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Color palette</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {COLORS.map(c => (
                <div key={c.name} className="flex flex-col gap-2">
                  <div
                    className="h-14 rounded-2 border border-paper-3"
                    style={{ background: c.hex }}
                  />
                  <div>
                    <p className="text-label text-ink font-medium">{c.label}</p>
                    <p className="text-body-sm text-ink-6 font-mono">{c.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Status pills ────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Order lifecycle — status pills</h2>
            <div className="flex flex-wrap gap-3">
              {ORDER_STAGES.map(stage => (
                <Pill key={stage} status={stage} />
              ))}
            </div>
            <p className="mt-4 text-body-sm text-ink-6">
              Five-state strict enum: received → cooking → ready → picked_up → cancelled
            </p>
          </section>

          {/* ── Typography ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Type scale</h2>
            <div className="space-y-8">
              {TYPE_SCALE.map(t => (
                <div key={t.name} className="flex gap-6 items-start border-b border-paper-3 pb-6">
                  <div className="w-32 shrink-0">
                    <p className="text-label text-ink-6">{t.label}</p>
                    <p className="text-body-sm text-ink-8 font-mono">{t.name}</p>
                  </div>
                  <p className={t.className + ' text-ink'}>{t.sample}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Spacing ─────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Spacing scale (4px base)</h2>
            <div className="space-y-3">
              {SPACING.map(px => (
                <div key={px} className="flex items-center gap-4">
                  <span className="w-12 text-mono text-ink-6 font-mono">{px}px</span>
                  <div className="h-4 bg-saffron rounded-1" style={{ width: `${px}px` }} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Radius ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Border radius</h2>
            <div className="flex flex-wrap gap-6">
              {RADII.map(r => (
                <div key={r.value} className="flex flex-col gap-2 items-center">
                  <div
                    className="w-16 h-16 bg-paper-2 border border-paper-3"
                    style={{ borderRadius: r.value }}
                  />
                  <div className="text-center">
                    <p className="text-label text-ink">{r.value}</p>
                    <p className="text-body-sm text-ink-6">{r.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Shadow ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Shadow levels</h2>
            <div className="flex gap-8">
              <div className="flex flex-col gap-2 items-center">
                <div className="w-24 h-24 rounded-3 bg-paper border border-paper-3" />
                <p className="text-body-sm text-ink-6">No shadow (default)</p>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <div className="w-24 h-24 rounded-3 bg-paper shadow-1" />
                <p className="text-body-sm text-ink-6">Shadow 1 — popover</p>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <div className="w-24 h-24 rounded-3 bg-paper shadow-2" />
                <p className="text-body-sm text-ink-6">Shadow 2 — modal</p>
              </div>
            </div>
          </section>

          {/* ── Motion ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Motion tokens</h2>
            <div className="space-y-4 max-w-md">
              {[
                { label: 'Press (80ms)', dur: 'duration-press', scale: 'active:scale-[0.98]' },
                { label: 'Hover (120ms)', dur: 'duration-hover', scale: '' },
                { label: 'Standard (160ms)', dur: 'duration-standard', scale: '' },
                { label: 'Large (260ms)', dur: 'duration-large', scale: '' },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-4">
                  <span className="w-36 text-body-sm text-ink-6">{m.label}</span>
                  <div
                    className={`h-8 w-32 rounded-2 bg-saffron opacity-100 hover:opacity-50 transition-opacity ease-standard cursor-pointer ${m.dur} ${m.scale}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Buttons ─────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Buttons</h2>
            <div className="space-y-6">
              {/* Variants */}
              <div>
                <p className="text-label text-ink-6 mb-3">Variants</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Send to kitchen</Button>
                  <Button variant="secondary">Add modifier</Button>
                  <Button variant="ghost">Cancel order</Button>
                  <Button variant="destructive">Delete item</Button>
                  <Button variant="link">View full menu</Button>
                </div>
              </div>
              {/* Sizes */}
              <div>
                <p className="text-label text-ink-6 mb-3">Sizes</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
              {/* Disabled */}
              <div>
                <p className="text-label text-ink-6 mb-3">Disabled state</p>
                <div className="flex gap-3">
                  <Button disabled>Disabled primary</Button>
                  <Button variant="secondary" disabled>Disabled secondary</Button>
                </div>
              </div>
            </div>

            {/* Icon buttons */}
            <div className="mt-8">
              <p className="text-label text-ink-6 mb-3">Icon buttons</p>
              <div className="flex gap-3">
                <IconButton label="Settings" variant="ghost">
                  <Settings size={20} />
                </IconButton>
                <IconButton label="More options" variant="ghost">
                  <MoreHorizontal size={20} />
                </IconButton>
                <IconButton label="Delete" variant="outline">
                  <Trash2 size={20} />
                </IconButton>
              </div>
            </div>
          </section>

          {/* ── Form controls ───────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Form controls</h2>
            <div className="max-w-sm space-y-6">
              <Input label="Item name" placeholder="e.g. Wild Mushroom Tagliatelle" />
              <Input label="Price" placeholder="0.00" hint="Enter price in euros." />
              <Input label="With error" placeholder="Enter a value" error="This field is required." />
              <Textarea label="Description" placeholder="One-line description visible to guests on the menu." />
              <div className="space-y-3">
                <Switch
                  label="Accepting orders"
                  checked={switchOn}
                  onChange={e => setSwitchOn(e.target.checked)}
                />
                <Switch label="Available (checked)" defaultChecked />
                <Switch label="Disabled" disabled />
              </div>
            </div>
          </section>

          {/* ── Card ────────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Card</h2>
            <div className="grid gap-4 max-w-sm">
              <Card>
                <CardHeader>
                  <CardTitle>Wild Mushroom Tagliatelle</CardTitle>
                  <CardDescription>Earthy pasta with forest mushrooms, thyme and parmesan cream.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-mono text-ink tnum">€18.50</span>
                    <Pill status="received" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ── Dropdown ────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Dropdown menu</h2>
            <DropdownMenu
              trigger={
                <Button variant="secondary" size="sm">
                  <MoreHorizontal size={16} />
                  Actions
                </Button>
              }
              items={[
                { label: 'Edit item', icon: <Settings size={14} />, onClick: () => {} },
                { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => {} },
                { label: 'Mark featured', icon: <Star size={14} />, onClick: () => {} },
                { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => {}, variant: 'destructive' },
              ]}
            />
          </section>

          {/* ── Sheet ───────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Sheet (bottom)</h2>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Wild Mushroom Tagliatelle">
              <div className="space-y-4">
                <p className="text-body text-ink">
                  Earthy pasta with seasonal forest mushrooms, fresh thyme and parmesan cream. Served with sourdough.
                </p>
                <div className="flex items-center justify-between py-3 border-t border-paper-3">
                  <span className="text-label text-ink-6">Price</span>
                  <span className="font-mono text-mono text-ink tnum">€18.50</span>
                </div>
                <Button className="w-full">Add to order</Button>
              </div>
            </Sheet>
          </section>

          {/* ── Drawer ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Drawer (right side)</h2>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open side drawer</Button>
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Edit item">
              <div className="space-y-5">
                <Input label="Item name" defaultValue="Wild Mushroom Tagliatelle" />
                <Textarea label="Description" defaultValue="Earthy pasta with seasonal forest mushrooms, fresh thyme and parmesan cream." />
                <Input label="Price" defaultValue="18.50" />
                <Switch label="Available" defaultChecked />
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1">Save changes</Button>
                  <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                </div>
              </div>
            </Drawer>
          </section>

          {/* ── Toast ───────────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Toast notifications</h2>
            <ToastDemo />
          </section>

          {/* ── Kitchen ticket specimen ──────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Kitchen ticket specimen</h2>
            <p className="text-body-sm text-ink-6 mb-4">Dark surface, square corners (radius 0), 2px left status rail — exactly as specified.</p>
            <div className="bg-ink rounded-none inline-block">
              {(['received', 'cooking', 'ready', 'cancelled'] as OrderStage[]).map(stage => {
                const railColor: Record<string, string> = {
                  received: '#D97706',
                  cooking: '#C28A00',
                  ready: '#3F7A3A',
                  cancelled: '#B3321A',
                }
                return (
                  <div
                    key={stage}
                    className="flex mb-4 last:mb-0"
                    style={{ borderLeft: `2px solid ${railColor[stage]}` }}
                  >
                    <div className="bg-paper p-3 w-56">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-mono text-ink tnum">T 7</span>
                        <Pill status={stage} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-sans text-body-sm text-ink"><span className="font-mono tnum text-ink-6">2×</span> Tagliatelle</p>
                        <p className="font-sans text-body-sm text-ink"><span className="font-mono tnum text-ink-6">1×</span> Caesar salad</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono text-mono text-ink-6 tnum">04:32</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Animation ───────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-overline uppercase tracking-[0.08em] text-ink-6 mb-6">Kitchen new-order pulse</h2>
            <div className="inline-block bg-paper border border-paper-3 p-3 rounded-none animate-order-pulse">
              <p className="font-mono text-mono text-ink">T 3 · New order arriving</p>
            </div>
          </section>

        </div>
      </div>
    </ToastProvider>
  )
}
