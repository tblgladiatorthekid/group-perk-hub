import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Users,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { AffiliationGroup, MembershipStatus, Profile, UserMembership } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerifiedBadge } from "@/components/perk/VerifiedBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/verifications")({
  component: VerificationsQueue,
});

const nav = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin", label: "Brands (soon)", icon: <Store className="h-4 w-4" /> },
  { to: "/admin/groups", label: "Groups", icon: <Users className="h-4 w-4" /> },
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
];

type Status = MembershipStatus;

type Row = UserMembership & { group: AffiliationGroup | null; profile: Profile | null };

function VerificationsQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-memberships", status],
    queryFn: async (): Promise<Row[]> => {
      const [memberships, groups] = await Promise.all([
        apiClient<UserMembership[]>(`/memberships?status=${status}`),
        apiClient<AffiliationGroup[]>("/groups"),
      ]);
      const groupMap = new Map(groups.map((g) => [g.id, g]));

      const userIds = Array.from(new Set(memberships.map((m) => m.userId)));
      const profiles = userIds.length
        ? await apiClient<Profile[]>(`/profiles?ids=${userIds.join(",")}`)
        : [];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return memberships.map((m) => ({
        ...m,
        group: groupMap.get(m.groupId) ?? null,
        profile: profileMap.get(m.userId) ?? null,
      }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      to,
      reason,
    }: {
      id: string;
      to: "verified" | "rejected";
      reason?: string;
    }) => {
      await apiClient(`/memberships/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: to,
          rejectionReason: to === "rejected" ? (reason ?? "Not verifiable") : null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-memberships"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      toast.success("Updated");
    },
    onError: (e) =>
      toast.error("Update failed", { description: e instanceof Error ? e.message : "" }),
  });

  async function openDoc(key: string) {
    try {
      const { downloadUrl } = await apiClient<{ downloadUrl: string }>(
        `/storage/presign-download?key=${encodeURIComponent(key)}`,
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open document");
    }
  }

  return (
    <DashboardShell
      title="Membership verifications"
      subtitle="Review, approve or reject pending submissions."
      nav={nav}
      accent="Admin"
    >
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)} className="mb-6">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title={`No ${status} submissions`}
          description="Nothing to review here right now."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {r.profile?.fullName ?? "Unnamed member"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.group?.name} <span className="text-xs uppercase">· {r.group?.type}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">Method</div>
                      <div className="font-medium capitalize">{r.method.replace("_", " ")}</div>
                    </div>
                    {r.membershipNumber && (
                      <div>
                        <div className="text-muted-foreground">Member #</div>
                        <div className="font-mono">{r.membershipNumber}</div>
                      </div>
                    )}
                    {r.profile?.phone && (
                      <div>
                        <div className="text-muted-foreground">Phone</div>
                        <div>{r.profile.phone}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground">Submitted</div>
                      <div>{new Date(r.createdAt).toLocaleDateString("en-NG")}</div>
                    </div>
                  </div>
                </div>
                <VerifiedBadge status={r.status} />
              </div>

              {r.idDocumentUrl && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => openDoc(r.idDocumentUrl!)}>
                    <ExternalLink className="h-4 w-4" /> View ID document
                  </Button>
                </div>
              )}

              {status === "pending" && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex-1">
                    <Label htmlFor={`reason-${r.id}`} className="text-xs">
                      Rejection reason (optional)
                    </Label>
                    <Input
                      id={`reason-${r.id}`}
                      placeholder="e.g. ID document unreadable"
                      value={reasons[r.id] ?? ""}
                      onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        decide.mutate({ id: r.id, to: "rejected", reason: reasons[r.id] })
                      }
                      disabled={decide.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => decide.mutate({ id: r.id, to: "verified" })}
                      disabled={decide.isPending}
                    >
                      {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Approve
                    </Button>
                  </div>
                </div>
              )}

              {r.status === "rejected" && r.rejectionReason && (
                <div className="mt-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                  {r.rejectionReason}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
