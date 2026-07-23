import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Ticket, TrendingUp } from "lucide-react";
import type { Deal, Brand, RedemptionCode } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface RedemptionCodeAnalyticsData {
  totalCodes: number;
  totalRedemptions: number;
  codesByStatus: { status: string; count: number }[];
  topDealsByRedemptions: { dealId: string; dealTitle: string; codeCount: number; redemptionCount: number }[];
  topBrandsByRedemptions: { brandId: string; brandName: string; redemptionCount: number }[];
  dailyRedemptions: { date: string; count: number }[];
  recentRedemptions: { id: string; code: string; dealTitle: string; brandName: string; redeemedAt: string | null }[];
}

const nav = [
  { to: "/admin", label: "Overview", icon: <ArrowLeft className="h-4 w-4" /> },
  { to: "/admin/verifications", label: "Verifications", icon: <ArrowLeft className="h-4 w-4" /> },
  { to: "/admin/brands", label: "Brands", icon: <ArrowLeft className="h-4 w-4" /> },
  { to: "/admin/deals", label: "Deals", icon: <ArrowLeft className="h-4 w-4" /> },
  { to: "/admin/groups", label: "Groups", icon: <ArrowLeft className="h-4 w-4" /> },
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/admin/redemption-codes", label: "Redemption codes", icon: <Ticket className="h-4 w-4" /> },
];

export const Route = createFileRoute("/_authenticated/admin/redemption-codes")({
  component: AdminRedemptionCodesPage,
});

function AdminRedemptionCodesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-redemption-code-analytics"],
    queryFn: () => apiClient<RedemptionCodeAnalyticsData>("/admin/redemption-codes/analytics"),
  });

  const { data: codes, isLoading: codesLoading } = useQuery({
    queryKey: ["admin-redemption-codes", statusFilter],
    queryFn: () => apiClient<RedemptionCode[]>(`/redemption-codes?status=${statusFilter === "all" ? "" : statusFilter}`),
  });

  return (
    <DashboardShell
      title="Redemption codes"
      subtitle="Monitor code usage, track redemptions, and identify underperforming discounts."
      nav={nav}
      accent="Admin"
    >
      {analyticsLoading || codesLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { k: "Total codes", v: analytics?.totalCodes ?? 0 },
              { k: "Total redemptions", v: analytics?.totalRedemptions ?? 0 },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">{s.k}</div>
                <div className="mt-2 font-display text-3xl font-bold">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Redemptions by deal</h3>
              <p className="text-sm text-muted-foreground">Top deals by redemption count.</p>
              {!analytics?.topDealsByRedemptions || analytics.topDealsByRedemptions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No redemption data yet.</p>
              ) : (
                <ChartContainer config={{ redemptionCount: { label: "Redemptions", color: "var(--chart-1)" } }} className="mt-4 aspect-auto h-64 w-full">
                  <BarChart data={analytics.topDealsByRedemptions} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                    <YAxis type="category" dataKey="dealTitle" tickLine={false} axisLine={false} width={140} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="redemptionCount" fill="var(--color-redemptionCount)" radius={4} barSize={20} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Redemptions by brand</h3>
              <p className="text-sm text-muted-foreground">Top brands by redemption count.</p>
              {!analytics?.topBrandsByRedemptions || analytics.topBrandsByRedemptions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No redemption data yet.</p>
              ) : (
                <ChartContainer config={{ redemptionCount: { label: "Redemptions", color: "var(--chart-3)" } }} className="mt-4 aspect-auto h-64 w-full">
                  <BarChart data={analytics.topBrandsByRedemptions} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                    <YAxis type="category" dataKey="brandName" tickLine={false} axisLine={false} width={140} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="redemptionCount" fill="var(--color-redemptionCount)" radius={4} barSize={20} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">Recent redemptions</h3>
                <p className="text-sm text-muted-foreground">Latest 20 transactions.</p>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Redeemed at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!analytics?.recentRedemptions || analytics.recentRedemptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No redemptions yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    analytics.recentRedemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell>{r.dealTitle}</TableCell>
                        <TableCell>{r.brandName}</TableCell>
                        <TableCell>{r.redeemedAt ? new Date(r.redeemedAt).toLocaleString("en-NG") : "N/A"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">All redemption codes</h3>
            <p className="text-sm text-muted-foreground">Browse and manage redemption codes.</p>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!codes || codes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No redemption codes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    codes.map((code, idx) => (
                      <TableRow key={code.id || idx}>
                        <TableCell className="font-mono text-xs">{code.code}</TableCell>
                        <TableCell>Deal {code.dealId}</TableCell>
                        <TableCell>Brand {code.brandId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {code.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{code.useCount} / {code.maxUses}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}