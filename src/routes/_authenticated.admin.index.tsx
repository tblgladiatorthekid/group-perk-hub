import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LayoutDashboard, ShieldCheck, Store, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

const nav = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin", label: "Brands (soon)", icon: <Store className="h-4 w-4" /> },
  { to: "/admin", label: "Groups (soon)", icon: <Users className="h-4 w-4" /> },
  { to: "/admin", label: "Transactions (soon)", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/admin", label: "Commissions (soon)", icon: <Wallet className="h-4 w-4" /> },
];

function AdminHome() {
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [groups, brands, memberships, txs] = await Promise.all([
        supabase.from("affiliation_groups").select("id", { count: "exact", head: true }),
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("user_memberships").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("id", { count: "exact", head: true }),
      ]);
      return {
        groups: groups.count ?? 0,
        brands: brands.count ?? 0,
        pendingVerifications: memberships.count ?? 0,
        transactions: txs.count ?? 0,
      };
    },
  });

  return (
    <DashboardShell
      title="Admin console"
      subtitle="Verify members, approve brands, publish deals, and track every naira of commission."
      nav={nav}
      accent="Admin"
    >
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { k: "Affiliation groups", v: counts?.groups ?? 0 },
          { k: "Brands", v: counts?.brands ?? 0 },
          { k: "Pending verifications", v: counts?.pendingVerifications ?? 0 },
          { k: "Redemptions", v: counts?.transactions ?? 0 },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs font-medium text-muted-foreground">{s.k}</div>
            <div className="mt-2 font-display text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

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
