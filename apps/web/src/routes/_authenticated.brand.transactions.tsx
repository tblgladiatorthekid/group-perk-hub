import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Receipt, Tag, Wallet } from "lucide-react";
import type { Brand, Deal, Transaction } from "@perkhub/shared";
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

export const Route = createFileRoute("/_authenticated/brand/transactions")({
  component: BrandTransactions,
});

const nav = [
  { to: "/brand", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/brand/apply", label: "Business profile", icon: <Building2 className="h-4 w-4" /> },
  { to: "/brand/deals", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/brand/transactions", label: "Transactions", icon: <Receipt className="h-4 w-4" /> },
  { to: "/brand/commissions", label: "Commissions", icon: <Wallet className="h-4 w-4" /> },
];

function BrandTransactions() {
  const { data: myBrand } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

  const { data: deals } = useQuery({
    queryKey: ["my-deals", myBrand?.id],
    enabled: !!myBrand?.id,
    queryFn: () => apiClient<Deal[]>(`/deals?status=all&brandId=${myBrand!.id}`),
  });

  const { data: transactions } = useQuery({
    queryKey: ["my-transactions", myBrand?.id],
    enabled: !!myBrand?.id,
    queryFn: () => apiClient<Transaction[]>(`/transactions?brandId=${myBrand!.id}`),
  });

  const dealTitleById = new Map((deals ?? []).map((d) => [d.id, d.title]));

  if (!myBrand) {
    return (
      <DashboardShell
        title="Transactions"
        subtitle="Complete your brand application first."
        nav={nav}
        accent="Brand partner"
      >
        <EmptyState
          title="No brand on file"
          description="Submit your brand application to start seeing redemptions here."
          action={
            <Link to="/brand/apply" className="text-sm font-medium text-primary underline">
              Apply as a brand
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Transactions"
      subtitle="Every redemption of your deals, newest first."
      nav={nav}
      accent={myBrand.name}
    >
      {!transactions || transactions.length === 0 ? (
        <EmptyState
          title="No redemptions yet"
          description="Once members start redeeming your deals, they'll show up here."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Final price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.createdAt).toLocaleDateString("en-NG")}</TableCell>
                  <TableCell>{dealTitleById.get(t.dealId) ?? "—"}</TableCell>
                  <TableCell className="capitalize">{t.method}</TableCell>
                  <TableCell>{formatNaira(t.finalPrice)}</TableCell>
                  <TableCell>{formatNaira(t.discountApplied)}</TableCell>
                  <TableCell>{formatNaira(t.commissionAmount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.status === "redeemed"
                          ? "default"
                          : t.status === "disputed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardShell>
  );
}
