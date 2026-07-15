# Admin affiliation group management — design

Date: 2026-07-15

## Problem

The backend (`apps/api/src/routes/groups.ts`) already supports full CRUD for
affiliation groups plus whitelist management, and the consumer side
(`_authenticated.app.verify.tsx`, `_authenticated.app.membership.tsx`) already
lets members pick a group and submit verification against it. But there is no
admin UI to create, edit, deactivate, or manage the whitelist for affiliation
groups — admins currently have no way to add a new group (e.g. a new NYSC
batch, a new cooperative, a new professional body) without going around the
app. Both `_authenticated.admin.index.tsx` and
`_authenticated.admin.verifications.tsx` already have a `"Groups (soon)"` nav
placeholder pointing at this gap.

## Scope

In scope:
- Admin list of all affiliation groups (active and inactive).
- Create / edit a group's core fields.
- Activate / deactivate a group (soft-delete only — see below).
- Manage a group's membership-number whitelist (list / add / remove entries).
- Small backend extension to let admins list inactive groups too.

Out of scope:
- Hard delete of groups. `user_memberships.groupId` uses
  `onDelete: "restrict"` at the DB level, so a group with any memberships
  can't be hard-deleted anyway; the existing `active` flag is the intended
  soft-delete mechanism, consistent with how brands (`suspended`) and deals
  (`expired`) are deactivated elsewhere in admin rather than deleted.
- Server-side validation (zod, etc.) on group create/update — no route in
  this app currently validates request bodies beyond what Drizzle enforces at
  the DB layer (see `brands.ts`, `deals.ts`), so this feature stays
  consistent with that rather than introducing validation unilaterally.
- Automated tests for the new route — no existing route-level tests exist for
  brands/deals/groups (`apps/api` only has `membership.service.test.ts` and a
  health check), so this feature doesn't introduce new test scaffolding.

## Backend change

`GET /api/groups` currently always filters to `active` groups only
(`groupRoutes.get("/", ...)` in `apps/api/src/routes/groups.ts`). Extend it to
support `?status=all`, requiring admin auth, mirroring the existing
`brands.ts` convention:

```
brandRoutes.get("/", async (c) => {
  const status = c.req.query("status") ?? "approved";
  ...
  if (status === "all") { /* requires admin, manual Clerk check */ }
});
```

No query param preserves today's public "active only" behavior for the
consumer verify flow. `POST /`, `PATCH /:id`, and the whitelist endpoints are
already admin-gated via `requireAuth` + `userRolesRepo.hasRole` — no changes
needed there.

## Frontend

### New route: `apps/web/src/routes/_authenticated.admin.groups.tsx`

Follows the `_authenticated.admin.brands.tsx` / `.deals.tsx` pattern: a
`DashboardShell` with a simple "← Back to overview" nav (not the full sidebar
nav array), fetching via `apiClient` + TanStack Query, mutating via
`useMutation` + `qc.invalidateQueries` + `sonner` toasts — same shape as
`AdminBrands`.

Body:
- **Groups list** — one card per group (same visual style as `BrandRow` /
  `DealRow`): name, `type` badge, active/inactive badge, verification
  methods, email domains, badge validity (months).
- **"New group" button** at the top of the page → opens the create dialog.
- **Per-group row actions**:
  - "Edit" → opens the same dialog, prefilled with the group's current
    values (update mode).
  - "Activate" / "Deactivate" → `PATCH /groups/:id` toggling `active`,
    mirroring the brands suspend/reinstate mutation.
  - "Whitelist" → opens the whitelist dialog for that group.

### Group create/edit dialog

A shadcn `Dialog` wrapping one shared form component used for both create and
edit (edit mode pre-fills from the selected group).

Fields:
- `name` — text input, required.
- `type` — `Select`, options from `AFFILIATION_TYPES`
  (`packages/shared/src/enums.ts`): cooperative, alumni, professional, nysc,
  corporate, religious, union, other.
- `description` — `Textarea`, optional.
- `verificationMethods` — three `Checkbox`es: id_upload, email_domain,
  membership_number.
- `emailDomains` — single text input; value is split on commas (and
  trimmed) into a `string[]` on submit.
- `badgeValidityMonths` — number input.

`active` is **not** a form field — it defaults to `true` on create and is
otherwise controlled only by the list page's Activate/Deactivate action, to
keep the dialog focused on group definition rather than status.

Submit: `POST /groups` (create) or `PATCH /groups/:id` (edit), then
`qc.invalidateQueries({ queryKey: ["admin-groups"] })` and a success toast on
completion, error toast on failure — same as `AdminBrands`'s `setStatus`
mutation.

### Whitelist dialog

Opened per-group from the "Whitelist" row action. On open, fetches
`GET /groups/:id/whitelist`. Renders:
- A list of existing entries (`membershipNumber`, `fullName`) each with a
  "Remove" button → `DELETE /groups/:id/whitelist/:entryId`.
- A small add-entry form (`membershipNumber` + `fullName` inputs, "Add"
  button) → `POST /groups/:id/whitelist`.

Same `useMutation` / invalidate / toast pattern as the rest of the page.

### Nav wiring

Update the two existing `{ to: "/admin", label: "Groups (soon)", ... }`
placeholder entries — in `_authenticated.admin.index.tsx` and
`_authenticated.admin.verifications.tsx` — to
`{ to: "/admin/groups", label: "Groups", ... }`.

## Data flow summary

```
Admin groups page
  ├─ GET /api/groups?status=all          → list (active + inactive)
  ├─ POST /api/groups                    → create
  ├─ PATCH /api/groups/:id               → edit fields / toggle active
  ├─ GET /api/groups/:id/whitelist       → whitelist dialog open
  ├─ POST /api/groups/:id/whitelist      → add entry
  └─ DELETE /api/groups/:id/whitelist/:entryId → remove entry
```

All admin-gated server-side via `requireAuth` + `hasRole(..., "admin")`,
consistent with every other admin route.
