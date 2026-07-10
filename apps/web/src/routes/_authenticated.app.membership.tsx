import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, Home, Sparkles, Ticket, User } from "lucide-react";
import { useUser } from "@clerk/tanstack-react-start";
import type { AffiliationGroup, Profile, UserMembership } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/perk/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/app/membership")({
  component: MembershipCardPage,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app/verify", label: "Verify membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app/membership", label: "My card", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app", label: "Deals (soon)", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app", label: "Profile (soon)", icon: <User className="h-4 w-4" /> },
];

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function MembershipCardPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const { data, isLoading } = useQuery({
    queryKey: ["my-memberships", "with-profile"],
    queryFn: async () => {
      const [memberships, groups, profile] = await Promise.all([
        apiClient<UserMembership[]>("/memberships"),
        apiClient<AffiliationGroup[]>("/groups"),
        apiClient<Profile>("/profiles/me"),
      ]);
      const groupMap = new Map(groups.map((g) => [g.id, g]));
      return {
        memberships: memberships.map((m) => ({ ...m, group: groupMap.get(m.groupId) ?? null })),
        profile,
      };
    },
  });

  const memberships = data?.memberships ?? [];
  const profile = data?.profile;

  return (
    <DashboardShell
      title="Membership card"
      subtitle="Show this at partner locations or use the code on partner websites."
      nav={nav}
      accent="Consumer"
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : memberships.length === 0 ? (
        <EmptyState
          title="No memberships yet"
          description="Verify an affiliation to receive your digital PerkHub card."
          action={
            <Button asChild>
              <Link to="/app/verify">Start verification</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {memberships.map((m) => {
            const payload = JSON.stringify({
              pid: m.id,
              g: m.group?.name,
              n: profile?.fullName,
              exp: m.expiresAt,
            });
            return (
              <article
                key={m.id}
                className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider opacity-80">PerkHub Member</div>
                    <div className="mt-1 font-display text-2xl font-bold">
                      {profile?.fullName ?? "Member"}
                    </div>
                  </div>
                  <VerifiedBadge status={m.status} className="bg-white/20 border-white/30 text-white" />
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider opacity-70">Affiliation</div>
                      <div className="font-medium">{m.group?.name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="opacity-70">Member #</div>
                        <div className="font-mono">{m.membershipNumber ?? email?.split("@")[0] ?? "—"}</div>
                      </div>
                      <div>
                        <div className="opacity-70">Valid until</div>
                        <div>{formatDate(m.expiresAt)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <QRCodeSVG value={payload} size={92} level="M" />
                  </div>
                </div>

                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/30 blur-2xl" />
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
