import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Home, Sparkles, Ticket, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/perk/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/app")({
  component: ConsumerHome,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app", label: "Deals", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app", label: "My redemptions", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app", label: "Membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app", label: "Profile", icon: <User className="h-4 w-4" /> },
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
            ) : memberships && memberships.length > 0 ? (
              <VerifiedBadge status={memberships[0].status as "pending" | "rejected" | "expired"} />
            ) : (
              <span className="text-sm text-muted-foreground">Not started</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Deals unlocked</div>
          <div className="mt-2 font-display text-3xl font-bold">0</div>
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
              <Button size="lg" disabled>
                Start verification (Phase 2)
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Deal browsing coming next"
            description="Your verification is on file. Deal discovery, redemption codes, and saved deals ship in Phase 4 of the build."
            action={
              <Button asChild variant="outline">
                <Link to="/">Back to home</Link>
              </Button>
            }
          />
        )}
      </div>
    </DashboardShell>
  );
}
