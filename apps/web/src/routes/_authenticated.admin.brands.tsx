import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Brand } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/brands")({
  component: AdminBrands,
});

function AdminBrands() {
  const qc = useQueryClient();
  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: () => apiClient<Brand[]>("/brands?status=all"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Brand["status"] }) =>
      apiClient<Brand>(`/brands/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast.success("Brand updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = brands?.filter((b) => b.status === "pending") ?? [];
  const others = brands?.filter((b) => b.status !== "pending") ?? [];

  return (
    <DashboardShell
      title="Brand approvals"
      subtitle="Review new brand applications and manage existing partners."
      nav={[{ to: "/admin", label: "Back to overview", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent="Admin"
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : brands && brands.length === 0 ? (
        <EmptyState
          title="No brand applications yet"
          description="Brand partners will appear here after they apply."
        />
      ) : (
        <div className="space-y-8">
          <Section title={`Pending (${pending.length})`}>
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No pending applications.
              </div>
            ) : (
              pending.map((b) => (
                <BrandRow
                  key={b.id}
                  b={b}
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() => setStatus.mutate({ id: b.id, status: "approved" })}
                      >
                        <Check className="mr-1.5 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: b.id, status: "suspended" })}
                      >
                        <X className="mr-1.5 h-4 w-4" /> Reject
                      </Button>
                    </>
                  }
                />
              ))
            )}
          </Section>

          <Section title="All brands">
            {others.map((b) => (
              <BrandRow
                key={b.id}
                b={b}
                actions={
                  b.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: b.id, status: "suspended" })}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setStatus.mutate({ id: b.id, status: "approved" })}
                    >
                      Reinstate
                    </Button>
                  )
                }
              />
            ))}
          </Section>
        </div>
      )}
    </DashboardShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BrandRow({ b, actions }: { b: Brand; actions: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="font-display text-base font-semibold">{b.name}</div>
          <Badge variant="outline" className="capitalize">
            {b.status}
          </Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {b.category} · {b.contactEmail}
          {b.cacNumber ? ` · CAC ${b.cacNumber}` : ""}
        </div>
        {b.description && (
          <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
            {b.description}
          </p>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          Commission:{" "}
          {b.commissionType === "percent" ? `${b.commissionRate}%` : `₦${b.commissionRate} flat`}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
