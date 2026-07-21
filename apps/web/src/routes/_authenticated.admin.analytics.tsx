import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, LayoutDashboard, ShieldCheck, Store, Tag, Users } from "lucide-react";
import type { CommissionStatus } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AdminAnalyticsPage,
});

const nav = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin/verifications", label: "Verifications", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin/brands", label: "Brands", icon: <Store className="h-4 w-4" /> },
  { to: "/admin/deals", label: "Deals", icon: <Tag className="h-4 w-4" /> },
  { to: "/admin/groups", label: "Groups", icon: <Users className="h-4 w-4" /> },
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "Pending",
  invoiced: "Invoiced",
  paid: "Paid",
};

const STATUS_COLORS: Record<CommissionStatus, string> = {
  pending: "var(--chart-4)",
  invoiced: "var(--chart-2)",
  paid: "var(--chart-1)",
};

interface AdminAnalyticsData {
  year: number;
  monthly: { month: number; transactionCount: number; commissionAmount: number }[];
  byBrand: { brandId: string; brandName: string; commissionAmount: number }[];
  byStatus: { status: CommissionStatus; commissionAmount: number }[];
  histogram: { bucket: string; count: number }[];
}

const lineConfig: ChartConfig = {
  commissionAmount: { label: "Commission", color: "var(--chart-1)" },
};
const brandConfig: ChartConfig = {
  commissionAmount: { label: "Commission", color: "var(--chart-3)" },
};
const histogramConfig: ChartConfig = {
  count: { label: "Transactions", color: "var(--chart-4)" },
};
const statusConfig: ChartConfig = {
  pending: { label: "Pending", color: STATUS_COLORS.pending },
  invoiced: { label: "Invoiced", color: STATUS_COLORS.invoiced },
  paid: { label: "Paid", color: STATUS_COLORS.paid },
};

function AdminAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const { data } = useQuery({
    queryKey: ["admin-analytics", year],
    queryFn: () => apiClient<AdminAnalyticsData>(`/admin/analytics?year=${year}`),
  });

  const hasData =
    !!data && (data.monthly.some((m) => m.transactionCount > 0) || data.byBrand.length > 0);

  return (
    <DashboardShell
      title="Analytics"
      subtitle="Transaction volume and commission revenue across the fiscal year."
      nav={nav}
      accent="Admin"
    >
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Fiscal year</span>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data ? null : !hasData ? (
        <EmptyState
          title={`No transactions in ${year}`}
          description="Once redemptions happen this fiscal year, trends and breakdowns will appear here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Commission trend</h3>
            <p className="text-sm text-muted-foreground">Monthly commission revenue, {year}.</p>
            <ChartContainer config={lineConfig} className="mt-4 aspect-auto h-64 w-full">
              <LineChart
                data={data.monthly.map((m) => ({ ...m, monthLabel: MONTH_LABELS[m.month - 1] }))}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v: number) => formatNaira(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatNaira(Number(value))} />
                  }
                />
                <Line
                  dataKey="commissionAmount"
                  type="monotone"
                  stroke="var(--color-commissionAmount)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-commissionAmount)" }}
                />
              </LineChart>
            </ChartContainer>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View as table
              </summary>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.monthly.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{MONTH_LABELS[m.month - 1]}</TableCell>
                      <TableCell>{m.transactionCount}</TableCell>
                      <TableCell>{formatNaira(m.commissionAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Top brands by commission</h3>
            <p className="text-sm text-muted-foreground">Top 8 brands, {year}.</p>
            {data.byBrand.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No brand commission data yet.</p>
            ) : (
              <>
                <ChartContainer config={brandConfig} className="mt-4 aspect-auto h-64 w-full">
                  <BarChart data={data.byBrand} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatNaira(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="brandName"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(value) => formatNaira(Number(value))} />
                      }
                    />
                    <Bar
                      dataKey="commissionAmount"
                      fill="var(--color-commissionAmount)"
                      radius={4}
                      barSize={20}
                    />
                  </BarChart>
                </ChartContainer>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View as table
                  </summary>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead>Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byBrand.map((b) => (
                        <TableRow key={b.brandId}>
                          <TableCell>{b.brandName}</TableCell>
                          <TableCell>{formatNaira(b.commissionAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Commission by status</h3>
            <p className="text-sm text-muted-foreground">Pending vs. invoiced vs. paid, {year}.</p>
            <ChartContainer config={statusConfig} className="mt-4 aspect-square h-64 w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatNaira(Number(value))} />
                  }
                />
                <Pie
                  data={data.byStatus}
                  dataKey="commissionAmount"
                  nameKey="status"
                  outerRadius={90}
                  label={(entry: { status?: string; percent?: number }) =>
                    `${STATUS_LABELS[entry.status as CommissionStatus]} ${Math.round((entry.percent ?? 0) * 100)}%`
                  }
                >
                  {data.byStatus.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status]}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="status" />} />
              </PieChart>
            </ChartContainer>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View as table
              </summary>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byStatus.map((s) => (
                    <TableRow key={s.status}>
                      <TableCell>{STATUS_LABELS[s.status]}</TableCell>
                      <TableCell>{formatNaira(s.commissionAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Transaction size distribution</h3>
            <p className="text-sm text-muted-foreground">
              Count of redemptions by commission amount, {year}.
            </p>
            <ChartContainer config={histogramConfig} className="mt-4 aspect-auto h-64 w-full">
              <BarChart data={data.histogram} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={28} />
              </BarChart>
            </ChartContainer>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View as table
              </summary>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Commission range</TableHead>
                    <TableHead>Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.histogram.map((h) => (
                    <TableRow key={h.bucket}>
                      <TableCell>{h.bucket}</TableCell>
                      <TableCell>{h.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
