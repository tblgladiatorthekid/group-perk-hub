# Consumer Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give consumers a `/app/profile` page with a Personal Info tab (edit name/phone/state/LGA + avatar) and a Group Affiliations tab (full membership list).

**Architecture:** One new frontend route (`_authenticated.app.profile.tsx`) built entirely on existing backend endpoints (`GET/PATCH /profiles/me`, `POST /storage/presign-upload`, `GET /storage/presign-download`, `GET /memberships`, `GET /groups`) — no backend changes. Plus nav wiring across the four existing consumer pages that carry a `"Profile (soon)"` placeholder.

**Tech Stack:** TanStack Start/Router + TanStack Query + shadcn/ui (Tabs, Avatar). Bun workspaces.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-15-consumer-profile-design.md`.
- No backend changes — every endpoint this feature needs already exists and is already `requireAuth`-gated.
- No state/LGA picker component — plain text `Input`s (no such dataset/component exists anywhere in this codebase).
- No new automated tests — no route/component-level test scaffolding exists anywhere in this repo today.
- **Verification note:** `bun` may not be on PATH in the shell executing this plan. Use the equivalent local binaries instead: `./node_modules/.bin/tsc` (from repo root). If `bun` *is* available, `bun run build:web` works identically.
- **Known pre-existing baseline (unrelated to this feature, do not fix):** `tsc -b apps/web/tsconfig.json` currently reports 2 errors in `_authenticated.brand.apply.tsx` and `_authenticated.brand.deals.tsx` (a `zodResolver`/`.default()` typing quirk, unrelated to this feature). Verification steps below check for *no new* errors, not zero errors.

---

### Task 1: Consumer profile page (Personal Info + Group Affiliations tabs)

**Files:**
- Create: `apps/web/src/routes/_authenticated.app.profile.tsx`

**Interfaces:**
- Consumes: `apiClient<T>(path, options)` from `@/lib/api-client`; `Profile`, `AffiliationGroup`, `UserMembership` types from `@perkhub/shared`; `GET/PATCH /profiles/me`, `POST /storage/presign-upload`, `GET /storage/presign-download`, `GET /memberships`, `GET /groups` — all already implemented and already `requireAuth`-gated (`apps/api/src/routes/profiles.ts`, `apps/api/src/routes/storage.ts`).
- Produces: route path `/_authenticated/app/profile` (i.e. `/app/profile`), consumed by Task 2's nav wiring.

- [ ] **Step 1: Write the route file**

Create `apps/web/src/routes/_authenticated.app.profile.tsx`:

```tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Home, Loader2, Sparkles, Ticket, Upload, User } from "lucide-react";
import type { AffiliationGroup, Profile, UserMembership } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/perk/VerifiedBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app/verify", label: "Verify membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app/membership", label: "My card", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app/deals", label: "Deals", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app/profile", label: "Profile", icon: <User className="h-4 w-4" /> },
];

function ProfilePage() {
  return (
    <DashboardShell
      title="Your profile"
      subtitle="Manage your personal details and see every affiliation you've verified."
      nav={nav}
      accent="Consumer"
    >
      <Tabs defaultValue="personal" className="w-full">
        <TabsList>
          <TabsTrigger value="personal">Personal info</TabsTrigger>
          <TabsTrigger value="affiliations">Group affiliations</TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="mt-6">
          <PersonalInfoTab />
        </TabsContent>
        <TabsContent value="affiliations" className="mt-6">
          <AffiliationsTab />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function PersonalInfoTab() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => apiClient<Profile>("/profiles/me"),
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
    setState(profile.state ?? "");
    setLga(profile.lga ?? "");
  }, [profile]);

  const { data: avatarViewUrl } = useQuery({
    queryKey: ["my-avatar-url", profile?.avatarUrl],
    enabled: !!profile?.avatarUrl,
    queryFn: () =>
      apiClient<{ downloadUrl: string }>(
        `/storage/presign-download?key=${encodeURIComponent(profile!.avatarUrl!)}`,
      ).then((r) => r.downloadUrl),
  });

  const save = useMutation({
    mutationFn: (
      updates: Partial<Pick<Profile, "fullName" | "phone" | "state" | "lga" | "avatarUrl">>,
    ) =>
      apiClient<Profile>("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update profile"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({ fullName, phone, state, lga });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, key } = await apiClient<{ uploadUrl: string; key: string }>(
        "/storage/presign-upload",
        {
          method: "POST",
          body: JSON.stringify({ bucket: "avatars", fileName: file.name, contentType: file.type }),
        },
      );
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) throw new Error("Avatar upload failed");
      await save.mutateAsync({ avatarUrl: key });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const initials =
    (fullName || "?")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatarViewUrl && <AvatarImage src={avatarViewUrl} alt={fullName || "Avatar"} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <label
            htmlFor="avatar-upload"
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-2 text-sm hover:bg-secondary"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Change photo"}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={uploading}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Lagos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lga">LGA</Label>
            <Input id="lga" value={lga} onChange={(e) => setLga(e.target.value)} placeholder="e.g. Ikeja" />
          </div>
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

function AffiliationsTab() {
  const { data: memberships, isLoading } = useQuery({
    queryKey: ["my-memberships", "full"],
    queryFn: async () => {
      const [memberships, groups] = await Promise.all([
        apiClient<UserMembership[]>("/memberships"),
        apiClient<AffiliationGroup[]>("/groups"),
      ]);
      const groupMap = new Map(groups.map((g) => [g.id, g]));
      return memberships.map((m) => ({ ...m, group: groupMap.get(m.groupId) ?? null }));
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!memberships || memberships.length === 0) {
    return (
      <EmptyState
        title="No affiliations yet"
        description="Verify your first membership to unlock partner deals."
        action={
          <Button asChild>
            <Link to="/app/verify">Start verification</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {memberships.length} affiliation{memberships.length === 1 ? "" : "s"} on file
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/verify">Add another</Link>
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {memberships.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="font-medium">{m.group?.name ?? "Unknown group"}</div>
              <div className="text-xs uppercase text-muted-foreground">{m.group?.type}</div>
            </div>
            <div className="flex items-center gap-3">
              <VerifiedBadge status={m.status} />
              {m.status === "verified" && (
                <Button asChild size="sm" variant="ghost">
                  <Link to="/app/membership">View card</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check the web app**

```bash
./node_modules/.bin/tsc -b apps/web/tsconfig.json
```

Expected: the same 2 pre-existing errors from the Global Constraints baseline (`_authenticated.brand.apply.tsx`, `_authenticated.brand.deals.tsx`) and **nothing** referencing `_authenticated.app.profile.tsx`. If any error mentions the new file, fix it before proceeding.

Note: like Task 2 of the prior admin-affiliation-groups plan, adding a new file-based route requires `apps/web/src/routeTree.gen.ts` (TanStack Router's auto-generated route manifest) to be regenerated — this is expected, not hand-edited. Regenerate it by briefly running `./node_modules/.bin/vite dev` (or `../../node_modules/.bin/vite dev` from `apps/web`) until it writes the file, then stop the server. Discard any incidental `package-lock.json` diff `vite dev` produces (`git checkout -- package-lock.json`) before committing — it's tooling noise, not a dependency change.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated.app.profile.tsx apps/web/src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
Add consumer profile page with personal info and affiliations tabs

Personal Info edits name/phone/state/LGA and avatar via the existing
/profiles/me and /storage presign endpoints. Group Affiliations lists
every membership regardless of status, reusing the membership+group
join already used on the /app overview.
EOF
)"
```

---

### Task 2: Nav wiring

**Files:**
- Modify: `apps/web/src/routes/_authenticated.app.index.tsx:19`
- Modify: `apps/web/src/routes/_authenticated.app.membership.tsx:21`
- Modify: `apps/web/src/routes/_authenticated.app.deals.tsx:27`
- Modify: `apps/web/src/routes/_authenticated.app.verify.tsx:24`

**Interfaces:**
- Consumes: route path `/app/profile` produced by Task 1.
- Produces: nothing consumed elsewhere — last piece wiring users to the new page.

- [ ] **Step 1: Fix the placeholder in all four files**

In each of the four files listed above, change:

```tsx
  { to: "/app", label: "Profile (soon)", icon: <User className="h-4 w-4" /> },
```

to:

```tsx
  { to: "/app/profile", label: "Profile", icon: <User className="h-4 w-4" /> },
```

(The `User` icon import already exists in all four files — it's already used for this same nav entry.)

- [ ] **Step 2: Type-check the web app**

```bash
./node_modules/.bin/tsc -b apps/web/tsconfig.json
```

Expected: same result as Task 1 Step 2 — only the 2 known pre-existing errors, none in the four files just touched.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated.app.index.tsx apps/web/src/routes/_authenticated.app.membership.tsx apps/web/src/routes/_authenticated.app.deals.tsx apps/web/src/routes/_authenticated.app.verify.tsx
git commit -m "$(cat <<'EOF'
Link consumer nav to the new profile page

Replaces the "Profile (soon)" placeholders (in the overview, my-card,
deals, and verify pages) now that /app/profile exists.
EOF
)"
```

---

### Task 3: Manual browser verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-2.

Automated browser tooling is not available in this environment (confirmed during the prior admin-affiliation-groups feature: no `chromium-cli`, no Playwright installed). This is a manual QA checklist — **say explicitly whether each item passed, do not report the feature complete without running through this list in a real browser.**

- [ ] **Step 1: Start both dev servers**

If `bun` is on PATH: `bun run dev:api &` and `bun run dev:web &`.
Otherwise, from the repo root:
```bash
cd apps/api && ../../node_modules/.bin/tsx --env-file=.env src/index.ts &
cd apps/web && ../../node_modules/.bin/vite dev &
```

- [ ] **Step 2: Sign in as a consumer and open the page**

Sign in with a consumer-role test account, navigate to `/app`, click "Profile" in the nav (or go directly to `/app/profile`). Confirm the page loads with two tabs, defaulting to "Personal info".

- [ ] **Step 3: Edit personal info**

Change full name, phone, state, and LGA; click "Save changes". Confirm a success toast appears and the fields persist after a page reload (re-fetch from `/profiles/me`).

- [ ] **Step 4: Upload an avatar**

Click "Change photo", pick an image file. Confirm it uploads (loading spinner, then success toast) and the avatar renders in place of the initials fallback. Reload the page and confirm the avatar still renders (proves the presign-download resolution works on fresh load, not just from cached state).

- [ ] **Step 5: Group Affiliations tab**

Click the "Group affiliations" tab. If the account has memberships already (e.g. from the prior admin-affiliation-groups feature's manual QA), confirm they list with correct status badges and a working "View card" link for verified ones. If the account has none, confirm the empty state renders with a working "Start verification" link to `/app/verify`.

- [ ] **Step 6: Nav links**

From `/app`, `/app/membership`, `/app/deals`, and `/app/verify`, click the "Profile" nav item from each and confirm all four land on `/app/profile` (not the old "(soon)" no-op).

- [ ] **Step 7: Stop the dev servers**

```bash
kill %1 %2
```

No commit for this task — it's verification only. If any step fails, fix the underlying code in Task 1-2's files and re-run the relevant type-check before re-testing.
