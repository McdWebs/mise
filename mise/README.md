# Mise

Multi-restaurant ordering platform — guests order via QR code, kitchen sees orders in real time, owners manage their menu, platform admins oversee the fleet.

> The name comes from *mise en place* — the chef's ritual of having everything ready before service.

## Stack

- **Frontend** (`apps/web`): Vite + React 18 + TypeScript, React Router v6, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend** (`apps/api`): Fastify + TypeScript, deployed on Render
- **Database**: Supabase (Postgres + RLS + Auth + Realtime + Storage)
- **AI assistant**: Vercel AI SDK + Anthropic Claude, menu-grounded via structured tools
- **Hosting**: Vercel (web) + Render (api)

## Monorepo layout

```
mise/
├── apps/
│   ├── web/          Vite + React SPA
│   └── api/          Fastify backend
├── packages/
│   ├── tokens/       Tailwind preset (all design tokens from colors_and_type.css)
│   ├── ui/           Shared component library (Button, Pill, Sheet, etc.)
│   └── types/        Shared TypeScript types + Supabase-generated types
└── supabase/
    ├── migrations/   Postgres schema
    └── seed.sql      Bistro Calanque seed data
```

## Prerequisites

- Node 20+
- pnpm 9+
- Supabase CLI (for local dev): `brew install supabase/tap/supabase`

## Local setup

```bash
# 1. Clone and install
git clone <repo>
cd mise
pnpm install

# 2. Set up environment variables
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# 3. Start Supabase locally
supabase start
# This runs migrations and seed automatically

# 4. Start the dev servers (two terminals)
pnpm --filter web dev      # http://localhost:5173
pnpm --filter api dev      # http://localhost:3001

# 5. QA the design tokens
open http://localhost:5173/dev/tokens
```

## Routes

| Path | Surface |
|---|---|
| `/r/[slug]` | Guest ordering (public) |
| `/kitchen` | Kitchen display (auth required) |
| `/admin` | Owner admin (auth required) |
| `/platform` | Super-admin (super_admin role only) |
| `/dev/tokens` | Design token QA (dev only) |

## Supabase

```bash
supabase start          # start local stack
supabase db reset       # re-run migrations + seed
supabase gen types typescript --local > packages/types/src/database.types.ts
```

## Useful commands

```bash
pnpm -r build           # build all packages
pnpm -r typecheck       # typecheck all packages
pnpm --filter web dev   # web dev server only
pnpm --filter api dev   # api dev server only
```

## Deployment

See `DEPLOY.md` for Vercel + Render step-by-step instructions (added in Phase 8).
