import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Receipt, Tag } from "lucide-react";
import type { Brand } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/brand")({
  component: BrandHome,
});

const nav = [
  { to: "/brand", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/brand", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/brand", label: "Redemptions", icon: <Receipt className="h-4 w-4" /> },
  { to: "/brand", label: "Business profile", icon: <Building2 className="h-4 w-4" /> },
];

function BrandHome() {
  const { data: myBrand } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

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
          <div className="mt-2 font-display text-3xl font-bold">0</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Commission owed</div>
          <div className="mt-2 font-display text-3xl font-bold">₦0</div>
        </div>
      </div>

      <div className="mt-8">
        {!myBrand ? (
          <EmptyState
            title="Apply as a brand partner"
            description="Submit your business details — CAC number, category, contact — and PerkHub admins will review. Once approved, you can publish deals to targeted affiliation groups."
            action={<Button size="lg" disabled>Start application (Phase 3)</Button>}
          />
        ) : (
          <EmptyState
            title="Deal composer coming next"
            description="Your brand is on file. Deal creation, targeting, and analytics ship in Phase 3–5 of the build."
          />
        )}
      </div>
    </DashboardShell>
  );
}
