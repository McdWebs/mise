import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LogOut, Plus } from "lucide-react";
import { supabasePlatform as supabase } from "@/lib/supabasePlatform";
import { useFleet } from "../hooks/useFleet";
import { useSuperAdmin } from "../hooks/useSuperAdmin";
import { usePlatformCurrency } from "../hooks/usePlatformCurrency";
import { TenantInspector } from "../components/TenantInspector";
import { AnalyticsView } from "../components/AnalyticsView";
import { MessagesView } from "../components/MessagesView";
import { CreateRestaurantModal } from "../components/CreateRestaurantModal";
import { PlatformSettingsPage } from "./PlatformSettingsPage";
import type { FleetTenant } from "../hooks/useFleet";

type PlatformView = "fleet" | "analytics" | "messages" | "settings";
type FilterKey = "all" | "live" | "paused" | "issues";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All venues" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "issues", label: "With issues" },
];

function HealthDot({ health }: { health: FleetTenant["health"] }) {
  const color =
    health === "ok" ? "bg-herb" : health === "warn" ? "bg-honey" : "bg-ember";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function StatePill({ state }: { state: FleetTenant["state"] }) {
  const cfg = {
    live: { bg: "bg-herb-wash", text: "text-herb-2" },
    paused: { bg: "bg-paper-2", text: "text-ink-5" },
    suspended: { bg: "bg-ember-wash", text: "text-ember-2" },
  }[state] ?? { bg: "bg-paper-2", text: "text-ink-5" };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-[12px] font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {state}
    </span>
  );
}

function fmtLastSeen(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 30) return "live now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtRevenue(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function PlatformPage() {
  const { data: tenants = [], isLoading, dataUpdatedAt } = useFleet();
  const { user } = useSuperAdmin();
  const { currency: platformCurrency } = usePlatformCurrency();

  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("tab") as PlatformView | null) ?? "fleet";
  function setView(v: PlatformView) {
    setSearchParams(v === "fleet" ? {} : { tab: v }, { replace: false });
  }
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FleetTenant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = tenants;
    if (filter === "live") list = list.filter((t) => t.state === "live");
    if (filter === "paused")
      list = list.filter(
        (t) => t.state === "paused" || t.state === "suspended",
      );
    if (filter === "issues") list = list.filter((t) => t.health !== "ok");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tenants, filter, search]);

  const withErrors = tenants.filter((t) => t.health !== "ok").length;
  const totalUnread = tenants.reduce((sum, t) => sum + t.unreadMessages, 0);
  const lastSync = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const GRID = "28px 1fr 100px 110px 110px 90px 110px 28px";

  return (
    <div className="min-h-dvh bg-paper">
      {/* Top nav */}
      <header className="flex items-center gap-4 px-7 py-3.5 border-b border-paper-3 bg-paper">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            className="rounded-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="font-display text-[18px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Mise
          </span>
        </div>

        <div className="pl-3.5 border-l border-paper-3">
          <span className="text-overline text-ink-6 uppercase tracking-widest">
            Platform admin
          </span>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 ml-5 border border-paper-3 rounded-pill p-0.5">
          {(["fleet", "analytics", "messages", "settings"] as PlatformView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative px-3.5 py-1.5 rounded-pill text-body-sm font-medium capitalize transition-colors duration-hover ${
                view === v ? "bg-ink text-paper" : "text-ink-5 hover:text-ink"
              }`}
            >
              {v}
              {v === "messages" && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-ember text-paper text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center">
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-ink-6 hover:text-ink transition-colors duration-hover"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="px-8 py-7 max-w-[1480px]">
        {view === "settings" ? (
          user ? <PlatformSettingsPage user={user} /> : null
        ) : view === "messages" ? (
          <MessagesView />
        ) : view === "analytics" ? (
          <AnalyticsView />
        ) : (
          <>
            {/* Page header + search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
              <div>
                <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
                  Fleet
                </h1>
                <div className="text-body-sm text-ink-6 mt-0.5">
                  {tenants.length} venue{tenants.length !== 1 ? "s" : ""} ·{" "}
                  {withErrors} with errors · last sync {lastSync}
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-2 px-3.5 py-2 border-[1.5px] border-paper-4 rounded-pill min-w-[260px] w-full sm:w-auto sm:max-w-[320px]">
                  <span className="text-ink-7 text-[16px] leading-none shrink-0">
                    ⌕
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a tenant by name or slug…"
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-body text-ink placeholder:text-ink-7"
                  />
                </div>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover whitespace-nowrap shrink-0"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  New restaurant
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-3.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-pill border-[1.5px] text-body-sm font-medium transition-colors duration-hover whitespace-nowrap ${filter === f.key ? "bg-ink border-ink text-paper" : "bg-paper border-paper-4 text-ink hover:border-ink-5"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Fleet table */}
            <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
              {/* Table header */}
              <div
                className="grid gap-3.5 px-4.5 py-3 bg-paper-2 text-overline text-ink-6 uppercase tracking-widest"
                style={{ gridTemplateColumns: GRID, padding: "10px 18px" }}
              >
                <span />
                <span>Venue</span>
                <span>State</span>
                <span>Orders today</span>
                <span>Revenue</span>
                <span>Errors</span>
                <span>Last seen</span>
                <span />
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-body-sm text-ink-6">
                  No venues match this filter.
                </div>
              ) : (
                filtered.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="grid gap-3.5 border-t border-paper-3 items-center cursor-pointer hover:bg-paper-2 transition-colors duration-hover"
                    style={{ gridTemplateColumns: GRID, padding: "12px 18px" }}
                    onClick={() => setSelected(tenant)}
                  >
                    <HealthDot health={tenant.health} />

                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-display text-[16px] font-[500] text-ink tracking-[-0.005em] leading-tight">
                          {tenant.name}
                        </div>
                        {tenant.unreadMessages > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ember text-paper text-[11px] font-semibold flex items-center justify-center tabular-nums shrink-0">
                            {tenant.unreadMessages > 9
                              ? "9+"
                              : tenant.unreadMessages}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-ink-6 mt-0.5">
                        {window.location.host}/r/{tenant.slug}
                      </div>
                    </div>

                    <StatePill state={tenant.state} />

                    <span className="font-mono tabular-nums text-body-sm text-ink">
                      {tenant.ordersToday}
                    </span>

                    <span className="font-mono tabular-nums text-body-sm text-ink">
                      {fmtRevenue(tenant.revenueTodayCents, platformCurrency)}
                    </span>

                    <span
                      className={`font-mono tabular-nums text-body-sm ${tenant.errors > 0 ? "text-ember" : "text-ink-6"}`}
                    >
                      {tenant.errors}
                    </span>

                    <span className="font-mono text-[12px] text-ink-6">
                      {fmtLastSeen(tenant.lastSeenAt)}
                    </span>

                    <span className="text-ink-7 text-[16px]">›</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      <TenantInspector tenant={selected} onClose={() => setSelected(null)} />
      <CreateRestaurantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
