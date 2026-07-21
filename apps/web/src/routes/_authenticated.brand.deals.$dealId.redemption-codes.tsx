import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, Plus, Ticket, Trash2 } from "lucide-react";
import type { Deal, RedemptionCode } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/brand/deals/$dealId/redemption-codes")({
  component: DealRedemptionCodes,
});

function DealRedemptionCodes() {
  const qc = useQueryClient();
  const { dealId } = Route.useParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  const { data: deal } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => apiClient<Deal>(`/deals/${dealId}`),
    enabled: !!dealId,
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ["redemption-codes", "deal", dealId],
    queryFn: () => apiClient<RedemptionCode[]>(`/redemption-codes?dealId=${dealId}`),
    enabled: !!dealId,
  });

  const createCode = useMutation({
    mutationFn: async (maxUses: number) =>
      apiClient<RedemptionCode>("/redemption-codes", {
        method: "POST",
        body: JSON.stringify({ dealId, maxUses }),
      }),
    onSuccess: () => {
      toast.success("Redemption code created");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["redemption-codes", "deal", dealId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCode = useMutation({
    mutationFn: async (code: string) =>
      apiClient(`/redemption-codes/${code}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Code deleted");
      qc.invalidateQueries({ queryKey: ["redemption-codes", "deal", dealId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const toggleShow = (code: string) => {
    setShowCodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  if (!deal) {
    return (
      <DashboardShell
        title="Redemption codes"
        subtitle="Loading deal..."
        nav={[{ to: "/brand/deals", label: "Back", icon: <Eye className="h-4 w-4" /> }]}
        accent="Brand partner"
      />
    );
  }

  return (
    <DashboardShell
      title="Redemption codes"
      subtitle={`Manage codes for "${deal.title}"`}
      nav={[{ to: "/brand/deals", label: "Back to deals", icon: <Eye className="h-4 w-4" /> }]}
      accent={deal.status}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {codes?.length ?? 0} code{(codes?.length ?? 0) === 1 ? "" : "s"} total
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Generate code
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading codes...
        </div>
      ) : !codes || codes.length === 0 ? (
        <EmptyState
          title="No codes yet"
          description="Generate a redemption code to share with members."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Generate code
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {codes.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-mono text-sm font-semibold">
                    {showCodes[c.code] ? c.code : c.code.slice(0, 4) + "••••••••"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {c.status}
                    </Badge>
                    <span>
                      Uses: {c.useCount}/{c.maxUses}
                    </span>
                    {c.expiresAt && (
                      <span>
                        Expires: {new Date(c.expiresAt).toLocaleDateString("en-NG")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleShow(c.code)}
                  title={showCodes[c.code] ? "Hide code" : "Show code"}
                >
                  {showCodes[c.code] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyCode(c.code)}
                  title="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCode.mutate(c.code)}
                  title="Delete code"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate redemption code</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const maxUses = Number((e.target as HTMLFormElement).maxUses.value);
              createCode.mutate(maxUses);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Max uses</Label>
              <Input type="number" name="maxUses" min={1} defaultValue={1} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCode.isPending}>
                {createCode.isPending ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
