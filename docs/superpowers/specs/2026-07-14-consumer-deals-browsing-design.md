# Consumer deals browsing page — design

## Context

The consumer dashboard (`/app`) has a "Deals (soon)" nav placeholder — there is no
page where a verified member can actually browse partner offers. The API side is
already complete (`GET /deals`, `GET /brands`, `GET /memberships`,
`GET/POST/DELETE /saved-deals`); this is a frontend-only feature.

## Scope (confirmed with user)

- **Personalized**: deals are filtered to the groups the user is verified in by
  default, with a toggle to reveal deals for other groups too.
- **Save/unsave**: a heart toggle per card, backed by the existing saved-deals
  endpoints.
- **Details view only**: clicking a card opens a dialog with full details and a
  link to the redemption URL. No redemption/transaction flow in this pass.
- **No saved-only tab**: saved state is just a filled heart on the card.
- **No search/filter controls**: only the personalization toggle.

## Route

New file `apps/web/src/routes/_authenticated.app.deals.tsx` → `/app/deals`,
following the existing `_authenticated.app.*` route pattern (`DashboardShell`
wrapper, per-file `nav` array — matches `_authenticated.app.membership.tsx`).

Update the `nav` array's `"Deals (soon)"` entry in all three sibling route files
(`_authenticated.app.index.tsx`, `_authenticated.app.membership.tsx`,
`_authenticated.app.verify.tsx`) to point at `/app/deals` with label `"Deals"`.

## Data flow

Four parallel queries via the existing `apiClient` helper
(`apps/web/src/lib/api-client.ts`), mirroring the fetch-then-map pattern already
used in `_authenticated.app.index.tsx`:

- `GET /deals` (published, public) → `Deal[]`
- `GET /brands` (approved, public) → `Brand[]`, mapped by id for name/logo
- `GET /memberships` (own) → `UserMembership[]`, used to compute
  `verifiedGroupIds`
- `GET /saved-deals` (own) → `SavedDeal[]`, mapped to a `Set<dealId>` for heart
  state

Split `deals` into:
- `matching` — `targetGroupIds` intersects `verifiedGroupIds`
- `other` — everything else

If `verifiedGroupIds` is empty, skip the split and just show everything (no
group to personalize against yet — an `EmptyState` nudging toward
`/app/verify` covers the zero-deals case).

## UI

- Section 1: matching deals as a card grid (reuses the card visual language from
  `_authenticated.brand.deals.tsx`: `Badge` for discount/channel/end-date).
  Each card adds a brand name/logo line and a heart icon button (lucide
  `Heart`, filled when saved) that calls `POST /saved-deals` /
  `DELETE /saved-deals/:dealId` via a `useMutation`, invalidating the
  saved-deals query on success.
- Section 2: collapsed by default behind a "Show N deals from other groups"
  button; expands to the same card grid for `other`.
- Clicking a card (not the heart) opens a `Dialog` (same primitive used in
  `_authenticated.brand.deals.tsx`) with full description, terms, discount,
  channel, validity window, and a "Get this deal" button linking to
  `redemptionUrl` (disabled/absent if null).
- Empty state (no published deals at all) uses the existing `EmptyState`
  component.

## Out of scope

Redemption/transaction creation, search/filter controls, a dedicated
saved-deals view — all explicitly deferred per the scoping conversation.
