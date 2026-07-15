# Consumer profile page — design

Date: 2026-07-15

## Problem

Consumers have no dedicated profile page. Personal info (`fullName`, `phone`,
`state`, `lga`, `avatarUrl`) can already be edited via
`GET/PATCH /profiles/me` (`apps/api/src/routes/profiles.ts`), but no frontend
page exposes it. Every consumer route (`_authenticated.app.index.tsx`,
`.membership.tsx`, `.deals.tsx`, `.verify.tsx`) already carries a
`"Profile (soon)"` nav placeholder pointing at `/app` — the same kind of gap
the admin affiliation-groups feature just closed on the admin side.

## Scope

In scope:
- New route `/app/profile` with two tabs: Personal Info and Group
  Affiliations.
- Personal Info: edit `fullName`/`phone`/`state`/`lga` as plain text fields,
  plus avatar upload/display.
- Group Affiliations: a full list of the consumer's memberships (all
  statuses), reusing the existing membership+group join pattern.
- Nav wiring: fix the 4 `"Profile (soon)"` placeholders to point at
  `/app/profile`.

Out of scope:
- A Nigerian state/LGA picker/dropdown — no such component or data list
  exists anywhere in this codebase today; free-text inputs keep this
  feature self-contained. Introducing a state/LGA dataset is a separate
  concern.
- Removing or merging the existing `/app` overview's membership list or the
  `/app/membership` "My card" QR-code page — the new Group Affiliations tab
  is additive, not a replacement.
- Server-side validation beyond what `PATCH /profiles/me` already does
  (it already whitelists updatable fields; no new validation is being
  added, consistent with how `POST/PATCH /groups` was left in the prior
  feature).
- Automated tests — no route/component-level test scaffolding exists
  anywhere in this repo today.

## Route & structure

`apps/web/src/routes/_authenticated.app.profile.tsx`: `DashboardShell` with
the same consumer nav array used on every other `/app/*` page, wrapping a
shadcn `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` with two tabs:
"Personal Info" (default) and "Group Affiliations".

## Personal Info tab

- Fetches `GET /profiles/me` (`["my-profile"]` query key).
- Form fields: `fullName`, `phone`, `state`, `lga` — plain `Input`s, no
  picker component (see Scope).
- Save: `PATCH /profiles/me` with the changed fields, `useMutation` +
  `qc.invalidateQueries(["my-profile"])` + `sonner` toast on
  success/error — the same shape as every other mutation in this app
  (e.g. `AdminGroups`'s `save` mutation).
- Avatar: shadcn `Avatar` component. Upload reuses the exact presigned-URL
  flow already used for ID documents in `_authenticated.app.verify.tsx`:
  `POST /storage/presign-upload` with `{ bucket: "avatars", fileName }` →
  `PUT` the file to the returned `uploadUrl` → on success, include the
  returned `key` as `avatarUrl` in the profile `PATCH`. `"avatars"` is a new
  bucket name, following the same convention as the existing
  `"membership-docs"` bucket — no backend change needed, `presign-upload`
  already accepts an arbitrary bucket string.
- Display: since every R2 object in this app is private (there is no public
  bucket — both `presign-upload` and `presign-download` always mint
  short-lived signed URLs), rendering the current avatar means resolving
  `GET /storage/presign-download?key=<avatarUrl>` once on page load and
  using the returned URL as the `<Avatar>` image `src`. Falls back to
  initials (from `fullName`) or a placeholder icon when `avatarUrl` is
  `null` or the presign call fails.

## Group Affiliations tab

Reuses the membership+group join query already established in
`_authenticated.app.index.tsx` (`Promise.all([GET /memberships, GET
/groups])`, joined client-side by `groupId`). Renders every membership
regardless of status — pending/verified/rejected/expired — using the
existing `VerifiedBadge` component, with group name/type per row and a
"View card" link to `/app/membership` for verified rows. An "Add another"
button links to `/app/verify`. This is a fuller, dedicated view; it does not
remove or change the membership lists already on `/app` or `/app/membership`.

## Nav wiring

Replace `{ to: "/app", label: "Profile (soon)", icon: <User .../> }` with
`{ to: "/app/profile", label: "Profile", icon: <User .../> }` in all four
files that currently carry the placeholder:
`_authenticated.app.index.tsx`, `_authenticated.app.membership.tsx`,
`_authenticated.app.deals.tsx`, `_authenticated.app.verify.tsx`.

## Data flow summary

```
Consumer profile page
  ├─ GET /api/profiles/me                       → Personal Info tab
  ├─ PATCH /api/profiles/me                      → save personal info / avatarUrl
  ├─ POST /api/storage/presign-upload             → avatar upload URL
  ├─ GET /api/storage/presign-download?key=...    → avatar display URL
  ├─ GET /api/memberships + GET /api/groups       → Group Affiliations tab
```

All endpoints already exist and are already `requireAuth`-gated
(`profileRoutes.use("/*", requireAuth)`, `storageRoutes.use("/*",
requireAuth)`) — no backend changes in this feature.
