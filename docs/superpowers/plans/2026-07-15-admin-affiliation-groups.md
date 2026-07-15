# Admin Affiliation Group Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a page to create/edit/deactivate affiliation groups and manage each group's membership-number whitelist.

**Architecture:** One small backend extension (`GET /api/groups?status=all`, admin-gated) plus one new frontend route (`_authenticated.admin.groups.tsx`) that lists groups, opens a react-hook-form + zod dialog for create/edit, a toggle button for activate/deactivate, and a second dialog for whitelist entries — all following the exact patterns already used in `_authenticated.admin.brands.tsx` and `_authenticated.brand.deals.tsx`.

**Tech Stack:** Hono (API), TanStack Start/Router + TanStack Query + react-hook-form + zod + shadcn/ui (web). Bun workspaces.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-15-admin-affiliation-groups-design.md`. Every task below implements a section of it.
- No hard delete — only `active` toggle (design section "Scope", `onDelete: "restrict"` on `user_memberships.groupId`).
- No new server-side validation on `POST/PATCH /groups` — stay consistent with `brands.ts`/`deals.ts`, which pass the body straight to the repo.
- No new automated test scaffolding — no route-level tests exist today (`apps/api` only has `membership.service.test.ts` and a health check).
- **Verification note on this machine:** `bun` is not on PATH in the shell used to write this plan. All verification commands below use the equivalent local binaries in `node_modules/.bin` instead of `bun run ...`. If you're executing this plan somewhere `bun` *is* on PATH, the `bun run build:api` / `bun run test` / `bun run build:web` equivalents work identically — use whichever is available.
- **Known pre-existing baseline (unrelated to this feature, do not fix):** `tsc -b apps/web/tsconfig.json` currently reports 2 errors in `_authenticated.brand.apply.tsx` and `_authenticated.brand.deals.tsx` (a `zodResolver`/`.default()` typing quirk). Verification steps below check for *no new* errors, not zero errors. Also: `eslint .` across the whole repo currently reports ~6300 pre-existing `prettier/prettier` CRLF errors (this Windows checkout has `core.autocrlf=true`, unrelated to any code logic) — do not run full-repo lint as a gate; it was broken before this feature and fixing it is out of scope.

---

### Task 1: Backend — `GET /api/groups?status=all` for admins

**Files:**
- Modify: `apps/api/src/routes/groups.ts:10-13`

**Interfaces:**
- Consumes: `groupsRepo.listGroups(db)` (unchanged, returns all groups regardless of `active`), `userRolesRepo.hasRole(db, userId, "admin")` (already imported in this file).
- Produces: `GET /api/groups` (no query param) → active groups only, unchanged public behavior. `GET /api/groups?status=all` → all groups (active + inactive), admin-only. Both consumed by Task 2's `AdminGroups` component.

- [ ] **Step 1: Replace the `GET /` handler**

Current code (`apps/api/src/routes/groups.ts:10-13`):

```ts
groupRoutes.get("/", async (c) => {
  const groups = await groupsRepo.listGroups(db);
  return c.json(groups.filter((g) => g.active));
});
```

Replace with (mirrors the `?status=all` convention already used in `apps/api/src/routes/brands.ts:10-38`):

```ts
// Public list: only active by default. `?status=all` requires admin.
groupRoutes.get("/", async (c) => {
  const status = c.req.query("status") ?? "active";
  const all = await groupsRepo.listGroups(db);

  if (status === "active") {
    return c.json(all.filter((g) => g.active));
  }

  // Non-public statuses require admin
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
    });
    const auth = await clerkClient.authenticateRequest(c.req.raw);
    if (!auth.isSignedIn) return c.json({ error: "Unauthorized" }, 401);
    const uid = auth.toAuth().userId!;
    const isAdmin = await userRolesRepo.hasRole(db, uid, "admin");
    if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json(all);
});
```

- [ ] **Step 2: Type-check the API**

Run from the repo root:

```bash
./node_modules/.bin/tsc -b apps/api/tsconfig.json
```

Expected: no output, exit code 0 (matches the pre-change baseline — this file introduces no new types).

- [ ] **Step 3: Run the API test suite (regression check)**

```bash
cd apps/api && ../../node_modules/.bin/vitest run --config vitest.config.ts
```

Expected: `Test Files  2 passed (2)` / `Tests  3 passed (3)` — unchanged from baseline, confirms nothing broke.

- [ ] **Step 4: Smoke-test the new query param**

Start the API directly (bypasses `bun run dev:api`; loads `apps/api/.env` the same way Bun would auto-load it):

```bash
cd apps/api && ../../node_modules/.bin/tsx --env-file=.env src/index.ts &
```

Wait for `API server running at http://localhost:3001`, then:

```bash
curl -s http://localhost:3001/api/groups | head -c 200
```
Expected: a JSON array (possibly empty `[]` if no groups are seeded yet) — the default/public path, unchanged.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/groups?status=all
```
Expected: `401` — confirms the admin-gated path rejects unauthenticated requests.

Stop the server:

```bash
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/groups.ts
git commit -m "$(cat <<'EOF'
Allow admins to list inactive affiliation groups

GET /api/groups?status=all mirrors the brands/deals admin-listing
convention so the new admin groups page can show deactivated groups.
EOF
)"
```

---

### Task 2: Frontend — admin groups page (list, create/edit dialog, activate/deactivate, whitelist dialog)

**Files:**
- Create: `apps/web/src/routes/_authenticated.admin.groups.tsx`

**Interfaces:**
- Consumes: `apiClient<T>(path, options)` from `@/lib/api-client`; `AffiliationGroup`, `GroupWhitelistEntry` types from `@perkhub/shared`; `AFFILIATION_TYPES` values (`cooperative`, `alumni`, `professional`, `nysc`, `corporate`, `religious`, `union`, `other`) and `VERIFICATION_METHODS` values (`id_upload`, `email_domain`, `membership_number`) from `packages/shared/src/enums.ts` (hardcoded as string literals in the zod schema, matching how `_authenticated.brand.deals.tsx` hardcodes `discountType`/`channel` rather than importing the const arrays); `GET/POST/PATCH /groups`, `GET/POST/DELETE /groups/:id/whitelist[/:entryId]` from Task 1 and the existing `apps/api/src/routes/groups.ts`.
- Produces: route path `/_authenticated/admin/groups` (i.e. `/admin/groups`), consumed by Task 3's nav links.

- [ ] **Step 1: Write the route file**

Create `apps/web/src/routes/_authenticated.admin.groups.tsx`:

```tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus } from "lucide-react";
import type { AffiliationGroup, GroupWhitelistEntry } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const groupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum([
    "cooperative",
    "alumni",
    "professional",
    "nysc",
    "corporate",
    "religious",
    "union",
    "other",
  ]),
  description: z.string().optional(),
  verificationMethods: z
    .array(z.enum(["id_upload", "email_domain", "membership_number"]))
    .min(1, "Pick at least one verification method"),
  emailDomains: z.string().optional(),
  badgeValidityMonths: z.coerce.number().int().min(1, "Must be at least 1 month"),
});
type GroupForm = z.infer<typeof groupSchema>;

const VERIFICATION_METHOD_OPTIONS = [
  ["id_upload", "ID document upload"],
  ["email_domain", "Email domain match"],
  ["membership_number", "Membership number / whitelist"],
] as const;

export const Route = createFileRoute("/_authenticated/admin/groups")({
  component: AdminGroups,
});

function AdminGroups() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AffiliationGroup | null>(null);
  const [whitelistGroup, setWhitelistGroup] = useState<AffiliationGroup | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => apiClient<AffiliationGroup[]>("/groups?status=all"),
  });

  const form = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      type: "other",
      description: "",
      verificationMethods: [],
      emailDomains: "",
      badgeValidityMonths: 12,
    },
  });

  function openCreate() {
    setEditingGroup(null);
    form.reset({
      name: "",
      type: "other",
      description: "",
      verificationMethods: [],
      emailDomains: "",
      badgeValidityMonths: 12,
    });
    setOpen(true);
  }

  function openEdit(g: AffiliationGroup) {
    setEditingGroup(g);
    form.reset({
      name: g.name,
      type: g.type,
      description: g.description ?? "",
      verificationMethods: g.verificationMethods,
      emailDomains: g.emailDomains.join(", "),
      badgeValidityMonths: g.badgeValidityMonths,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async (v: GroupForm) => {
      const payload = {
        name: v.name,
        type: v.type,
        description: v.description?.trim() ? v.description.trim() : null,
        verificationMethods: v.verificationMethods,
        emailDomains: v.emailDomains
          ? v.emailDomains.split(",").map((d) => d.trim()).filter(Boolean)
          : [],
        badgeValidityMonths: v.badgeValidityMonths,
      };
      return editingGroup
        ? apiClient<AffiliationGroup>(`/groups/${editingGroup.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : apiClient<AffiliationGroup>("/groups", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      toast.success(editingGroup ? "Group updated" : "Group created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save group"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient<AffiliationGroup>(`/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      toast.success("Group updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const selectedMethods = form.watch("verificationMethods");

  return (
    <DashboardShell
      title="Affiliation groups"
      subtitle="Create and manage the groups members verify against."
      nav={[{ to: "/admin", label: "Back to overview", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent="Admin"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups?.length ?? 0} group{groups?.length === 1 ? "" : "s"} total
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New group
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          title="No affiliation groups yet"
          description="Create your first group so members have something to verify against."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-start md:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">{g.name}</div>
                  <Badge variant="outline" className="capitalize">{g.type}</Badge>
                  <Badge variant={g.active ? "default" : "secondary"}>
                    {g.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {g.description && (
                  <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {g.verificationMethods.map((m) => (
                    <Badge key={m} variant="outline" className="capitalize">
                      {m.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {g.emailDomains.length > 0
                    ? `Domains: ${g.emailDomains.join(", ")}`
                    : "No email domains"}{" "}
                  · Badge valid {g.badgeValidityMonths} month{g.badgeValidityMonths === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setWhitelistGroup(g)}>
                  Whitelist
                </Button>
                <Button
                  size="sm"
                  variant={g.active ? "outline" : "default"}
                  onClick={() => toggleActive.mutate({ id: g.id, active: !g.active })}
                  disabled={toggleActive.isPending}
                >
                  {g.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit group" : "New affiliation group"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="e.g. NYSC Batch A 2026" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v: GroupForm["type"]) =>
                  form.setValue("type", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="nysc">NYSC</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="religious">Religious</SelectItem>
                  <SelectItem value="union">Union</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={2} {...form.register("description")} />
            </div>

            <div className="space-y-1.5">
              <Label>Verification methods</Label>
              <div className="space-y-1.5 rounded-md border border-border p-3">
                {VERIFICATION_METHOD_OPTIONS.map(([value, label]) => {
                  const checked = selectedMethods.includes(value);
                  return (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const current = form.getValues("verificationMethods");
                          const next = v ? [...current, value] : current.filter((m) => m !== value);
                          form.setValue("verificationMethods", next, { shouldValidate: true });
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
              {form.formState.errors.verificationMethods && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.verificationMethods.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Email domains (comma-separated, optional)</Label>
              <Input {...form.register("emailDomains")} placeholder="unilag.edu.ng, nysc.gov.ng" />
            </div>

            <div className="space-y-1.5">
              <Label>Badge validity (months)</Label>
              <Input type="number" min={1} {...form.register("badgeValidityMonths")} />
              {form.formState.errors.badgeValidityMonths && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.badgeValidityMonths.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editingGroup ? "Save changes" : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WhitelistDialog group={whitelistGroup} onOpenChange={(v) => !v && setWhitelistGroup(null)} />
    </DashboardShell>
  );
}

function WhitelistDialog({
  group,
  onOpenChange,
}: {
  group: AffiliationGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [membershipNumber, setMembershipNumber] = useState("");
  const [fullName, setFullName] = useState("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["group-whitelist", group?.id],
    enabled: !!group,
    queryFn: () => apiClient<GroupWhitelistEntry[]>(`/groups/${group!.id}/whitelist`),
  });

  const addEntry = useMutation({
    mutationFn: () =>
      apiClient<GroupWhitelistEntry>(`/groups/${group!.id}/whitelist`, {
        method: "POST",
        body: JSON.stringify({ membershipNumber, fullName: fullName || null }),
      }),
    onSuccess: () => {
      setMembershipNumber("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["group-whitelist", group?.id] });
      toast.success("Added to whitelist");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add entry"),
  });

  const removeEntry = useMutation({
    mutationFn: (entryId: string) =>
      apiClient(`/groups/${group!.id}/whitelist/${entryId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-whitelist", group?.id] });
      toast.success("Removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove entry"),
  });

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group?.name} whitelist</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!membershipNumber.trim()) return;
            addEntry.mutate();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="wl-number">Membership number</Label>
            <Input
              id="wl-number"
              value={membershipNumber}
              onChange={(e) => setMembershipNumber(e.target.value)}
              placeholder="e.g. NYSC/2026/123456"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="wl-name">Full name (optional)</Label>
            <Input id="wl-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button type="submit" disabled={addEntry.isPending || !membershipNumber.trim()}>
            Add
          </Button>
        </form>

        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !entries || entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No whitelist entries yet.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="font-mono text-sm">{entry.membershipNumber}</div>
                  {entry.fullName && (
                    <div className="text-xs text-muted-foreground">{entry.fullName}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeEntry.mutate(entry.id)}
                  disabled={removeEntry.isPending}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check the web app**

```bash
./node_modules/.bin/tsc -b apps/web/tsconfig.json
```

Expected: the same 2 pre-existing errors from the Global Constraints baseline (`_authenticated.brand.apply.tsx`, `_authenticated.brand.deals.tsx`) and **nothing** referencing `_authenticated.admin.groups.tsx`. If any error mentions the new file, fix it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated.admin.groups.tsx
git commit -m "$(cat <<'EOF'
Add admin affiliation group management page

List, create/edit, activate/deactivate groups and manage each
group's membership-number whitelist, following the same
Dialog + react-hook-form + zod pattern used for brand deal
composition.
EOF
)"
```

---

### Task 3: Nav wiring

**Files:**
- Modify: `apps/web/src/routes/_authenticated.admin.index.tsx:17`
- Modify: `apps/web/src/routes/_authenticated.admin.verifications.tsx:23`

**Interfaces:**
- Consumes: route path `/admin/groups` produced by Task 2.
- Produces: nothing consumed elsewhere — this is the last piece wiring users to the new page.

- [ ] **Step 1: Fix the placeholder in the admin overview nav**

In `apps/web/src/routes/_authenticated.admin.index.tsx`, line 17, change:

```tsx
  { to: "/admin", label: "Groups (soon)", icon: <Users className="h-4 w-4" /> },
```

to:

```tsx
  { to: "/admin/groups", label: "Groups", icon: <Users className="h-4 w-4" /> },
```

- [ ] **Step 2: Fix the placeholder in the verifications nav**

In `apps/web/src/routes/_authenticated.admin.verifications.tsx`, line 23, change:

```tsx
  { to: "/admin", label: "Groups (soon)", icon: <Users className="h-4 w-4" /> },
```

to:

```tsx
  { to: "/admin/groups", label: "Groups", icon: <Users className="h-4 w-4" /> },
```

- [ ] **Step 3: Type-check the web app**

```bash
./node_modules/.bin/tsc -b apps/web/tsconfig.json
```

Expected: same result as Task 2 Step 2 — only the 2 known pre-existing errors, none in the files just touched.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated.admin.index.tsx apps/web/src/routes/_authenticated.admin.verifications.tsx
git commit -m "$(cat <<'EOF'
Link admin nav to the new groups management page

Replaces the "Groups (soon)" placeholders now that
/admin/groups exists.
EOF
)"
```

---

### Task 4: Manual browser verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-3.

This UI cannot be fully exercised by `curl`/`tsc` alone — `_authenticated.admin.tsx` sets `ssr: false` and gates on a real Clerk admin session, and creating/editing/toggling groups needs real interactive state. Automated browser tooling isn't available in the environment this plan was written in, so this task is a manual QA checklist. **Say explicitly whether each item passed — do not report the feature complete without running through this list in a real browser.**

- [ ] **Step 1: Start both dev servers**

If `bun` is on your PATH:
```bash
bun run dev:api &
bun run dev:web &
```
Otherwise, from the repo root:
```bash
cd apps/api && ../../node_modules/.bin/tsx --env-file=.env src/index.ts &
cd apps/web && ../../node_modules/.bin/vite dev &
```

- [ ] **Step 2: Sign in as an admin and open the page**

Sign in with an account that has the `admin` role, navigate to `/admin`, and click "Groups" in the sidebar nav (or go directly to `/admin/groups`). Confirm the page loads without a console error and the count/list render.

- [ ] **Step 3: Create a group**

Click "New group", fill in a name, pick a type, check at least one verification method, optionally add email domains and a description, submit. Confirm: a success toast appears, the dialog closes, and the new group appears in the list as "Active".

- [ ] **Step 4: Edit the group**

Click "Edit" on the group just created, change the name and verification methods, submit. Confirm the card updates in place.

- [ ] **Step 5: Deactivate / reactivate**

Click "Deactivate" on the group. Confirm its badge flips to "Inactive" and the button now reads "Activate". Click "Activate" and confirm it flips back.

- [ ] **Step 6: Whitelist**

Click "Whitelist" on the group. Add an entry (membership number + optional name), confirm it appears in the list. Remove it, confirm it disappears. Close the dialog.

- [ ] **Step 7: Nav links**

From `/admin` (overview) and `/admin/verifications`, click the "Groups" nav item and confirm both land on `/admin/groups` (not the old "(soon)" no-op).

- [ ] **Step 8: Stop the dev servers**

```bash
kill %1 %2
```

No commit for this task — it's verification only. If any step fails, fix the underlying code in Task 1-3's files and re-run the relevant type-check before re-testing.
