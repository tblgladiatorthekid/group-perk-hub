# Brand Transactions/Commissions + Admin Analytics — Design

## Context

The admin dashboard nav (`apps/web/src/routes/_authenticated.admin.index.tsx`) currently has two placeholder items — `"Transactions (soon)"` and `"Commissions (soon)"` — that both link back to `/admin` itself. No page was ever built behind them. Similarly the brand partner dashboard nav (`_authenticated.brand.index.tsx`) has a `"Redemptions (soon)"` placeholder.

The backend already fully supports both concepts: `GET /api/transactions?brandId=` and `GET /api/invoices?brandId=` (`apps/api/src/routes/transactions.ts`, `invoices.ts`) return a brand's own redemptions and commission invoices respectively, gated by role in the route handler.

This spec replaces the admin placeholders with a real **Analytics** tab (fiscal-year charts across all brands), and gives the brand partner dashboard real **Transactions** and **Commissions** tabs scoped to their own brand — since per-brand transaction/commission detail belongs to the brand, not the platform-wide admin console.

## Goals

- Brand partners can see their own redemption history and commission invoice status/history.
- Admins get a fiscal-year (calendar year) analytics view showing transaction volume and commission revenue trends, top brands by commission, commission status split, and transaction-size distribution.
- No new backend endpoints for the brand pages (existing endpoints already support this). One new backend endpoint for admin analytics aggregation.

## Non-goals

- No changes to the transaction creation/redemption flow itself.
- No CSV export, date-range pickers beyond a year selector, or drill-down/detail views in this pass.
- No changes to `commission_invoices` creation/payment workflow (that's existing `invoices.ts` CRUD, already admin-gated).

## Backend

### Brand-scoped pages: no changes required

`apps/api/src/routes/transactions.ts` and `invoices.ts` already filter by `brandId` for the `brand_partner` role. The frontend will call these exactly as `_authenticated.brand.index.tsx` already calls `GET /brands/mine` to get `myBrand.id`.

### New: `GET /api/admin/analytics?year=YYYY`

Added to `apps/api/src/routes/admin.ts`, gated by the same `requireAuth` + admin `hasRole` check used by `/admin/stats`. `year` defaults to the current calendar year if omitted.

Backed by a new `apps/api/src/services/analytics.service.ts::getAdminAnalytics(db, year)`, which queries `transactions` (joined to `brands` for names) restricted to `createdAt` within `[year-01-01, year-12-31 23:59:59]`, and returns:

```ts
{
  year: number;
  monthly: { month: number; transactionCount: number; commissionAmount: number }[]; // 12 entries, Jan–Dec, zero-filled for months with no data
  byBrand: { brandId: string; brandName: string; commissionAmount: number }[]; // top 8 by commissionAmount desc
  byStatus: { status: "pending" | "invoiced" | "paid"; commissionAmount: number }[]; // all 3 statuses present, zero-filled
  histogram: { bucket: string; count: number }[]; // fixed ₦ buckets: "0-1k", "1k-5k", "5k-10k", "10k-25k", "25k+"
}
```

Implementation uses Drizzle's `sql` template for `date_trunc('month', ...)` grouping and `case`-based bucketing for the histogram, avoiding pulling raw rows into the app layer. Money fields (`commissionAmount`) are Postgres `numeric`, returned as strings by Drizzle — the service converts to `number` before responding so the frontend can feed them directly to recharts.

## Frontend

### Brand dashboard

- **`apps/web/src/routes/_authenticated.brand.transactions.tsx`** (new): fetches `myBrand` (`GET /brands/mine`) then, once available, `GET /transactions?brandId=`. Renders a shadcn `Table` — Date, Deal, Method, Final price (`formatNaira`), Discount, Commission, Status — newest first (API already orders by `createdAt desc`). `EmptyState` if no brand or zero transactions.
- **`apps/web/src/routes/_authenticated.brand.commissions.tsx`** (new): fetches `myBrand` then `GET /invoices?brandId=`. Two summary cards ("Owed now" = sum of invoices where `status != 'paid'`, "Paid to date" = sum where `status == 'paid'`), then a `Table` — Period (start–end), Total amount, Status, Paid at.
- Nav array (duplicated across `_authenticated.brand.index.tsx` and the two new pages, matching the existing pattern where each page redefines `nav`): replace `{ to: "/brand", label: "Redemptions (soon)", icon: <Receipt /> }` with:
  ```ts
  { to: "/brand/transactions", label: "Transactions", icon: <Receipt className="h-4 w-4" /> },
  { to: "/brand/commissions", label: "Commissions", icon: <Wallet className="h-4 w-4" /> },
  ```

### Admin dashboard

- **`apps/web/src/routes/_authenticated.admin.analytics.tsx`** (new): a year `<select>` (options: current year and 2 prior years — data volume is low enough this is sufficient for now), driving `useQuery(["admin-analytics", year], () => apiClient(\`/admin/analytics?year=${year}\`))`. Renders 4 chart cards in a responsive grid, each `rounded-2xl border border-border bg-card p-6` matching existing card styling:
  - **Line chart** (recharts `LineChart`): `monthly` → commission amount trend (the primary revenue KPI) as a single line, Jan–Dec. Transaction count is not dual-axis'd onto the same chart (misleading at differing scales); it's shown via the histogram's total and the byBrand chart's implicit volume instead.
  - **Bar chart** (`BarChart`): `byBrand` → commission amount per brand, horizontal or vertical per dataviz form heuristic.
  - **Pie chart** (`PieChart`): `byStatus` → commission amount share by pending/invoiced/paid.
  - **Histogram** (`BarChart` with bucketed data, no gaps between bars): `histogram` → transaction count per commission-amount bucket.
  - Colors/accessibility follow the `dataviz` skill's palette and contrast guidance rather than ad hoc choices.
- Nav array in `_authenticated.admin.index.tsx`: remove the two `"(soon)"` entries, replace with:
  ```ts
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  ```
  (`BarChart3` and `Wallet` icon imports in admin.index.tsx are cleaned up if no longer used elsewhere on that page.)

## Data flow summary

```
Brand partner:
  brand.transactions page → GET /brands/mine → GET /transactions?brandId= → table

  brand.commissions page → GET /brands/mine → GET /invoices?brandId= → summary cards + table

Admin:
  admin.analytics page → GET /admin/analytics?year= → analytics.service.ts
                            → transactions repo query (grouped/aggregated via Drizzle sql)
                          → 4 recharts components
```

## Testing

- API: vitest coverage for `analytics.service.ts` — verifies month zero-fill, top-8-brand ordering/truncation, all-3-statuses zero-fill, and histogram bucket boundaries (e.g. exactly ₦1,000 falls in "1k-5k" not "0-1k").
- Frontend: manual verification via the `run` skill — sign in as a brand partner, confirm Transactions/Commissions tabs render real data (or correct empty states); sign in as admin, confirm Analytics tab renders all 4 charts with data for a year that has transactions and an empty/zero state for a year that doesn't.
