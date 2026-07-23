import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Ticket, Trash2 } from "lucide-react";
import type { Brand, Deal } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/deals")({
  component: AdminDeals,
});

function AdminDeals() {
  const qc = useQueryClient();
  const { data: roles } = useRoles();
  const isSuperAdmin = roles?.includes("super_admin") ?? false;

  const { data: deals, isLoading } = useQuery({
    queryKey: ["admin-deals"],
    queryFn: () => apiClient<Deal[]>("/deals?status=all"),
  });

  const { data: brands } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: () => apiClient<Brand[]>("/brands?status=all"),
  });
  const brandMap = new Map((brands ?? []).map((b) => [b.id, b]));

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      rejectionReason,
    }: {
      id: string;
      status: Deal["status"];
      rejectionReason?: string;
    }) =>
      apiClient<Deal>(`/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason: rejectionReason ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      toast.success("Deal updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => apiClient(`/deals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      toast.success("Deal deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = deals?.filter((d) => d.status === "pending_review") ?? [];
  const others = deals?.filter((d) => d.status !== "pending_review") ?? [];

  return (
    <DashboardShell
      title="Deal reviews"
      subtitle="Approve or reject brand-submitted offers before they go live."
      nav={[{ to: "/admin", label: "Back to overview", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent="Admin"
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : deals && deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Brand partners will submit deals for review here."
        />
      ) : (
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 font-display text-lg font-semibold">
              Pending review ({pending.length})
            </h3>
            <div className="space-y-3">
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No deals waiting on review.
                </div>
              ) : (
                pending.map((d) => (
                  <DealRow
                    key={d.id}
                    d={d}
                    brand={brandMap.get(d.brandId)}
                    actions={
                      isSuperAdmin ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setStatus.mutate({ id: d.id, status: "published" })}
                          >
                            <Check className="mr-1.5 h-4 w-4" /> Publish
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = window.prompt("Reason for rejection?") ?? "";
                              setStatus.mutate({
                                id: d.id,
                                status: "rejected",
                                rejectionReason: reason,
                              });
                            }}
                          >
                            <X className="mr-1.5 h-4 w-4" /> Reject
                          </Button>
                        </>
                      ) : null
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-display text-lg font-semibold">All deals</h3>
            <div className="space-y-3">
              {others.map((d) => (
                <DealRow
                  key={d.id}
                  d={d}
                  brand={brandMap.get(d.brandId)}
                  actions={
                    d.status === "published" ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/brand/deals/${d.id}/redemption-codes`}>
                            <Ticket className="mr-1.5 h-4 w-4" /> Manage codes
                          </Link>
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus.mutate({ id: d.id, status: "expired" })}
                          >
                            Unpublish
                          </Button>
                        )}
                      </>
                    ) : d.status === "rejected" || d.status === "draft" ? (
                      isSuperAdmin && (
                        <Button
                          size="sm"
                          onClick={() => setStatus.mutate({ id: d.id, status: "published" })}
                        >
                          Publish
                        </Button>
                      )
                    ) : d.status === "expired" ? (
                      isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteDeal.mutate(d.id)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                        </Button>
                      )
                    ) : null
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function DealRow({ d, brand, actions }: { d: Deal; brand?: Brand; actions: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="font-display text-base font-semibold">{d.title}</div>
          <Badge variant="outline" className="capitalize">
            {d.status.replace("_", " ")}
          </Badge>
          {d.durationType && (
            <Badge variant="secondary" className="capitalize">
              {d.durationType.replace("_", " ")}
            </Badge>
          )}
          {d.redemptionLimit && (
            <Badge variant="outline" className="capitalize">
              Limit: {d.redemptionLimit}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {brand?.name ?? "Unknown brand"} · {d.discountType} {d.discountValue}
          {d.discountType === "percent" ? "%" : ""} · {d.channel}
        </div>
        <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">{d.description}</p>
        <div className="mt-1 text-xs text-muted-foreground">
          {new Date(d.startDate).toLocaleDateString("en-NG")} →{" "}
          {new Date(d.endDate).toLocaleDateString("en-NG")} · target groups:{" "}
          {d.targetGroupIds.length}
        </div>
        {d.rejectionReason && (
          <div className="mt-1 text-xs text-destructive">Rejected: {d.rejectionReason}</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
