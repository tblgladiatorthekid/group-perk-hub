import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, LayoutDashboard, ShieldCheck, Store, Tag, Users, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Deal } from "@perkhub/shared";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

const nav = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin/brands", label: "Brands", icon: <Store className="h-4 w-4" /> },
  { to: "/admin/deals", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/admin/groups", label: "Groups", icon: <Users className="h-4 w-4" /> },
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/brand/transactions", label: "Transactions", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/brand/commissions", label: "Commissions", icon: <Wallet className="h-4 w-4" /> },
];

interface AdminStats {
  groups: number;
  brands: number;
  pendingVerifications: number;
  transactions: number;
  activeRedemptionCodes: number;
  poorPerformingDeals: Deal[];
}

function AdminHome() {
  const qc = useQueryClient();
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: () => apiClient<AdminStats>("/admin/stats"),
  });

  const autoExpire = useMutation({
    mutationFn: () => apiClient<{ expiredCount: number }>("/admin/deals/auto-expire-poor", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      toast.success("Poor-performing deals expired");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardShell
      title="Admin console"
      subtitle="Verify members, approve brands, publish deals, and track every naira of commission."
      nav={nav}
      accent="Admin"
    >
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { k: "Affiliation groups", v: counts?.groups ?? 0 },
          { k: "Brands", v: counts?.brands ?? 0 },
          { k: "Pending verifications", v: counts?.pendingVerifications ?? 0 },
          { k: "Redemptions", v: counts?.transactions ?? 0 },
          { k: "Active codes", v: counts?.activeRedemptionCodes ?? 0 },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs font-medium text-muted-foreground">{s.k}</div>
            <div className="mt-2 font-display text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      {counts?.poorPerformingDeals && counts.poorPerformingDeals.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Poor-performing deals</h3>
              <p className="text-sm text-muted-foreground">
                {counts.poorPerformingDeals.length} deal{counts.poorPerformingDeals.length === 1 ? "" : "s"} missed their
                performance threshold and may need attention.
              </p>
            </div>
            <Button variant="destructive" onClick={() => autoExpire.mutate()} disabled={autoExpire.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              {autoExpire.isPending ? "Expiring…" : "Expire all poor performers"}
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {counts.poorPerformingDeals.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
              >
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Threshold: {d.performanceThreshold} redemptions in {d.performanceCheckHours ?? 48}h
                  </div>
                </div>
                <Badge variant="destructive">Below threshold</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Membership review queue</h3>
            <p className="text-sm text-muted-foreground">
              {counts?.pendingVerifications ?? 0} submission
              {counts?.pendingVerifications === 1 ? "" : "s"} awaiting review.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/verifications">Open queue</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
