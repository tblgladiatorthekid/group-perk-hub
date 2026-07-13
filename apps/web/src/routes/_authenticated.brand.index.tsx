import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Receipt, Tag } from "lucide-react";
import type { Brand, Deal } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/brand/")({
  component: BrandHome,
});

const nav = [
  { to: "/brand", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/brand/apply", label: "Business profile", icon: <Building2 className="h-4 w-4" /> },
  { to: "/brand/deals", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/brand", label: "Redemptions (soon)", icon: <Receipt className="h-4 w-4" /> },
];

function BrandHome() {
  const { data: myBrand } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

  const { data: myDeals } = useQuery({
    queryKey: ["my-deals", myBrand?.id],
    enabled: !!myBrand?.id,
    queryFn: () => apiClient<Deal[]>(`/deals?status=all&brandId=${myBrand!.id}`),
  });

  const activeDeals = myDeals?.filter((d) => d.status === "published").length ?? 0;

  return (
    <DashboardShell
      title="Brand partner console"
      subtitle="Manage your business profile, deals, and commission-based redemptions."
      nav={nav}
      accent="Brand partner"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Brand status</div>
          <div className="mt-2 font-display text-lg font-semibold capitalize">
            {myBrand?.status ?? "Not applied"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Active deals</div>
          <div className="mt-2 font-display text-3xl font-bold">{activeDeals}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Commission owed</div>
          <div className="mt-2 font-display text-3xl font-bold">{formatNaira(0)}</div>
        </div>
      </div>

      <div className="mt-8">
        {!myBrand ? (
          <EmptyState
            title="Apply as a brand partner"
            description="Submit your business details — CAC number, category, contact — and PerkHub admins will review. Once approved, you can publish deals to targeted affiliation groups."
            action={
              <Button asChild size="lg">
                <Link to="/brand/apply">Start application</Link>
              </Button>
            }
          />
        ) : myBrand.status !== "approved" ? (
          <EmptyState
            title={`Your application is ${myBrand.status}`}
            description="Once an admin approves your brand, you'll be able to compose deals and target affiliation groups."
            action={
              <Button asChild variant="outline">
                <Link to="/brand/apply">Edit application</Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">Your deals</h3>
                <p className="text-sm text-muted-foreground">
                  {myDeals?.length ?? 0} total &middot; {activeDeals} live
                </p>
              </div>
              <Button asChild>
                <Link to="/brand/deals">Manage deals</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
