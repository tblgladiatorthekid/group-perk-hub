import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, LayoutDashboard, ShieldCheck, Store, Users, Wallet, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  { to: "/admin", label: "Groups (soon)", icon: <Users className="h-4 w-4" /> },
  { to: "/admin", label: "Transactions (soon)", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/admin", label: "Commissions (soon)", icon: <Wallet className="h-4 w-4" /> },
];

type Status = "pending" | "verified" | "rejected" | "expired";

function VerificationsQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-memberships", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_memberships")
        .select(
          "id, user_id, status, method, membership_number, id_document_url, rejection_reason, verified_at, expires_at, created_at, affiliation_groups(name, type)"
        )
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set(data.map((r) => r.user_id)));
      const profiles = userIds.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
        : { data: [] as { id: string; full_name: string | null; phone: string | null }[] };
      const map = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return data.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      to,
      reason,
    }: { id: string; to: "verified" | "rejected"; reason?: string }) => {
      const patch: Record<string, unknown> = { status: to };
      if (to === "rejected") patch.rejection_reason = reason ?? "Not verifiable";
      const { error } = await supabase.from("user_memberships").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-memberships"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error("Update failed", { description: e instanceof Error ? e.message : "" }),
  });

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("membership-docs").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
        <EmptyState title={`No ${status} submissions`} description="Nothing to review here right now." />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {r.profile?.full_name ?? "Unnamed member"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.affiliation_groups?.name}{" "}
                    <span className="text-xs uppercase">· {r.affiliation_groups?.type}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">Method</div>
                      <div className="font-medium capitalize">{r.method.replace("_", " ")}</div>
                    </div>
                    {r.membership_number && (
                      <div>
                        <div className="text-muted-foreground">Member #</div>
                        <div className="font-mono">{r.membership_number}</div>
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
                      <div>{new Date(r.created_at).toLocaleDateString("en-NG")}</div>
                    </div>
                  </div>
                </div>
                <VerifiedBadge status={r.status as Status} />
              </div>

              {r.id_document_url && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => openDoc(r.id_document_url!)}>
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
                      onClick={() => decide.mutate({ id: r.id, to: "rejected", reason: reasons[r.id] })}
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

              {r.status === "rejected" && r.rejection_reason && (
                <div className="mt-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                  {r.rejection_reason}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
