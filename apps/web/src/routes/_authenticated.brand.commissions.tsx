import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Receipt, Tag, Wallet } from "lucide-react";
import type { Brand, CommissionInvoice } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/brand/commissions")({
  component: BrandCommissions,
});

const nav = [
  { to: "/brand", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/brand/apply", label: "Business profile", icon: <Building2 className="h-4 w-4" /> },
  { to: "/brand/deals", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/brand/transactions", label: "Transactions", icon: <Receipt className="h-4 w-4" /> },
  { to: "/brand/commissions", label: "Commissions", icon: <Wallet className="h-4 w-4" /> },
];

function BrandCommissions() {
  const { data: myBrand } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

  const { data: invoices } = useQuery({
    queryKey: ["my-invoices", myBrand?.id],
    enabled: !!myBrand?.id,
    queryFn: () => apiClient<CommissionInvoice[]>(`/invoices?brandId=${myBrand!.id}`),
  });

  if (!myBrand) {
    return (
      <DashboardShell
        title="Commissions"
        subtitle="Complete your brand application first."
        nav={nav}
        accent="Brand partner"
      >
        <EmptyState
          title="No brand on file"
          description="Submit your brand application to start tracking commission invoices here."
          action={
            <Link to="/brand/apply" className="text-sm font-medium text-primary underline">
              Apply as a brand
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  const owedNow = (invoices ?? [])
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const paidToDate = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <DashboardShell
      title="Commissions"
      subtitle="Your commission invoices, from draft to paid."
      nav={nav}
      accent={myBrand.name}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Owed now</div>
          <div className="mt-2 font-display text-3xl font-bold">{formatNaira(owedNow)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Paid to date</div>
          <div className="mt-2 font-display text-3xl font-bold">{formatNaira(paidToDate)}</div>
        </div>
      </div>

      <div className="mt-8">
        {!invoices || invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Commission invoices are generated periodically once you have redemptions."
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Total amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {new Date(inv.periodStart).toLocaleDateString("en-NG")} –{" "}
                      {new Date(inv.periodEnd).toLocaleDateString("en-NG")}
                    </TableCell>
                    <TableCell>{formatNaira(inv.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "default"
                            : inv.status === "void" || inv.status === "overdue"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-NG") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
