# Feature ideas

What's already in the app: modifiers, special requests, order tracking, call waiter, tip selection, dietary tags on items, plans/deals with time windows, AI guest assistant, CSV export, item availability toggle, support tickets + AI, table floor map, waiter call acknowledgment, multi-currency, platform fleet + analytics + messages.

The list below is strictly what does **not** exist yet.

---

## Guest

### High value
- **Dietary filter bar** — guests filter the visible menu by tag (vegan, gluten-free, nut-free). Tags already exist on items; this just adds the filter UI above the category nav.
- **Reorder** — "Order same again" on the order status page that pushes the previous items straight back into the cart.
- **Item ratings** — thumbs up / down per item after the order is marked served. Aggregated per item in owner analytics.
- **Guest loyalty stamps** — digital stamp card tied to the table session or a phone number. Every N orders earns a free item or discount.
- **Saved cart** — restore cart if the guest closes the tab and reopens within the hour (localStorage + session fingerprint).

### Medium value
- **Split bill** — divide the table total by N and show each person's share before checkout.
- **Multiple language support** — owner adds translations per item; guest menu auto-switches based on browser language.
- **Photo / grid view** — toggle between the current list layout and a photo-first grid, useful for visually-led menus.
- **Share order link** — generate a shareable URL so someone not at the table can see live order status.

### Lower priority
- **Table-to-table message** — tap "send a message to another table" (e.g. happy birthday). Novelty but memorable.

---

## Owner (admin)

### High value
- **Payments / Stripe** — collect card payment at checkout; payout reports in the orders page. Currently stubbed.
- **Item-level analytics** — which items sell most, highest revenue per item, items never ordered. Shown in the menu editor alongside each item.
- **Daily / weekly summary email** — automated digest: orders, revenue, top items, vs. yesterday. Sent via edge function + Resend/SendGrid.
- **Staff accounts** — invite a second user (cashier, manager) with restricted access: no billing, no settings, no support.
- **Stock / 86 tracking** — mark an item sold-out for the day with one tap. Guests see it greyed out; resets at midnight.
- **Printer integration** — push new orders to a network or Bluetooth receipt printer automatically (Star Micronics / Epson).

### Medium value
- **Scheduled item availability** — hide / show individual items on a time schedule (e.g. breakfast items only before 11 am). Plans already have this; items don't.
- **Discount codes** — owner creates promo codes (% or fixed) guests enter at checkout.
- **Table reservations** — simple time-slot booking linked to a table; shows as a future event in the floor map.
- **Order note to kitchen** — owner adds a pinned internal note on any live order ("VIP — priority", "allergy confirmed").
- **Menu versioning / drafts** — save a draft and publish on a schedule, or roll back to the last published version.
- **Multi-location** — one owner account managing multiple branches; switch location in the admin shell.
- **Waitlist** — when all tables are occupied, guests join a digital queue and get a browser notification when a table opens.

### Lower priority
- **Custom domain** — serve the guest menu at `menu.myrestaurant.com` instead of the default slug URL.
- **Gift cards** — issue and redeem gift card codes at checkout.
- **Catering / pre-order mode** — guests order for a future date/time rather than right now.
- **Social auto-post** — publish a photo + caption for a new item or daily special to Instagram automatically.
- **Webhooks** — owner registers a URL that receives a POST on new order, stage change, or support reply.

---

## Kitchen

### High value
- **Sound alert for new orders** — optional audio ping when an order lands; togglable in the top bar.
- **Rush / priority flag** — owner or waiter marks an order urgent; it floats to the top of its lane with a highlight.
- **Per-item ticking** — check off individual items within an order as they're plated, not just the whole ticket.
- **Average ticket time** — show how long orders have been sitting in each lane; red if over a configurable target.

### Medium value
- **Multi-station split** — filter the kitchen view by station (grill, salads, desserts) so each station only sees relevant items.
- **Course firing** — hold starters in queue until the owner fires the main course; prevents food arriving all at once.
- **Bump bar mode** — keyboard shortcut (space / enter) advances the focused ticket to the next stage, hardware-bump-bar style.
- **Dedicated pickup screen** — separate read-only display for front-of-house showing only orders in the "ready" lane.

---

## Platform admin

### High value
- **Billing & subscription management** — assign a plan and monthly price per venue; auto-suspend on missed payment; billing status visible in the fleet inspector.
- **MRR / business dashboard** — platform-level metrics: monthly recurring revenue, churn, new signups, total GMV. Separate from per-venue order analytics.
- **Audit log** — record every platform action (suspend, unsuspend, create, delete, message) with actor, timestamp, and diff.
- **Tenant onboarding checklist** — track whether a new restaurant has completed key setup steps (menu item added, table created, test order placed). Progress bar in the fleet inspector.

### Medium value
- **Broadcast announcement** — send a banner message to all owners (or a filtered subset) that appears in their admin dashboard.
- **Usage quotas** — cap items per menu, tables, or monthly orders per plan tier; warning bar in owner settings when approaching limit.
- **White-label branding per tenant** — each restaurant sets a primary color and logo shown on their guest menu instead of the Mise brand.
- **Bulk fleet actions** — select multiple venues and suspend, message, or change plan in one action.
- **Data export per tenant** — download a full JSON/CSV dump of orders, menu, messages for a venue (compliance / offboarding).
- **Referral tracking** — attribute new signups to a referring restaurant; reward with a billing credit.
- **Changelog / release notes** — publish product updates that appear in a "What's new" section inside the owner dashboard.

---

## Cross-cutting

- **Push notifications** — web push for guests (order ready), owners (new order, new support reply), kitchen (new order alert).
- **Dark mode** — honor OS preference across guest, admin, and kitchen surfaces.
- **Offline / PWA** — cache menu for guest browsing without network; queue order and send when reconnected.
- **Mobile admin PWA** — lightweight installable app for owners to check orders, toggle availability, and respond to support from their phone.
- **Accessibility pass** — full keyboard navigation, ARIA labels, color-contrast audit on all three surfaces.
