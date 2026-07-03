import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LayoutDashboard, ShieldCheck, Store, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { primaryRole, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    const roles = (data ?? []).map((r) => r.role as AppRole);
    if (!roles.includes("admin")) throw redirect({ to: "/app" });
    return { role: primaryRole(roles) };
  },
  component: AdminHome,
});

const nav = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin", label: "Brands", icon: <Store className="h-4 w-4" /> },
  { to: "/admin", label: "Groups", icon: <Users className="h-4 w-4" /> },
  { to: "/admin", label: "Transactions", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/admin", label: "Commissions", icon: <Wallet className="h-4 w-4" /> },
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

      <div className="mt-8">
        <EmptyState
          title="Operational queues are wired next"
          description="Phase 2–5 fill in verification review, brand approvals, deal moderation, and commission reporting. The schema, RLS, and role gates are already live."
        />
      </div>
    </DashboardShell>
  );
}
