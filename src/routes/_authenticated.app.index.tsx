import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Home, Sparkles, Ticket, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/perk/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/app/")({
  component: ConsumerHome,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app/verify", label: "Verify membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app/membership", label: "My card", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app", label: "Deals (soon)", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app", label: "Profile (soon)", icon: <User className="h-4 w-4" /> },
];

function ConsumerHome() {
  const { data: memberships } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_memberships")
        .select("id, status, group_id, affiliation_groups(name, type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const verified = memberships?.some((m) => m.status === "verified");
  const primary = memberships?.[0];

  return (
    <DashboardShell
      title="Your PerkHub"
      subtitle="Verify your tribe, then start unlocking exclusive discounts."
      nav={nav}
      accent="Consumer"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Verification status</div>
          <div className="mt-3">
            {verified ? (
              <VerifiedBadge status="verified" />
            ) : primary ? (
              <VerifiedBadge status={primary.status as "pending" | "rejected" | "expired"} />
            ) : (
              <span className="text-sm text-muted-foreground">Not started</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Memberships on file</div>
          <div className="mt-2 font-display text-3xl font-bold">{memberships?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Total saved</div>
          <div className="mt-2 font-display text-3xl font-bold">₦0</div>
        </div>
      </div>

      <div className="mt-8">
        {!memberships || memberships.length === 0 ? (
          <EmptyState
            title="Verify your first membership"
            description="Pick your affiliation — NYSC, alumni, professional body, cooperative, staff association — and prove it once. Then every partner deal is yours to redeem."
            action={
              <Button asChild size="lg">
                <Link to="/app/verify">Start verification</Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Your memberships</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/verify">Add another</Link>
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{m.affiliation_groups?.name}</div>
                    <div className="text-xs uppercase text-muted-foreground">
                      {m.affiliation_groups?.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <VerifiedBadge status={m.status as "pending" | "verified" | "rejected" | "expired"} />
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
        )}
      </div>
    </DashboardShell>
  );
}
