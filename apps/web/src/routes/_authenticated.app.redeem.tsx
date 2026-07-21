import { useState, useEffect } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Ticket, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { Deal } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const searchSchema = {
  dealId: (v: string) => v,
};

export const Route = createFileRoute("/_authenticated/app/redeem")({
  validateSearch: (s) => ({ dealId: s.dealId as string | undefined }),
  component: RedeemPage,
});

function RedeemPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState("");
  const [dealId, setDealId] = useState(search.dealId || "");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: deal } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => apiClient<Deal>(`/deals/${dealId}`),
    enabled: !!dealId,
  });

  const redeem = useMutation({
    mutationFn: async () => {
      const res = await apiClient<{ success: boolean; message?: string }>("/transactions/redeem", {
        method: "POST",
        body: JSON.stringify({ code, dealId }),
      });
      return res;
    },
    onSuccess: (data) => {
      if (data.success) {
        setResult({ success: true, message: "Deal redeemed successfully!" });
        toast.success("Redemption successful");
      } else {
        setResult({ success: false, message: data.message || "Redemption failed" });
        toast.error(data.message || "Redemption failed");
      }
    },
    onError: (e: Error) => {
      setResult({ success: false, message: e.message });
      toast.error(e.message);
    },
  });

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    redeem.mutate();
  };

  return (
    <DashboardShell
      title="Redeem a deal"
      subtitle={
        deal
          ? `Redeem your code for "${deal.title}"`
          : "Enter your redemption code to claim a deal."
      }
      nav={[{ to: "/app", label: "Back", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent="Consumer"
    >
      <div className="mx-auto max-w-md">
        {result ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              {result.success ? (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {result.success ? "Success!" : "Oops"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
              </div>
              <Button asChild className="mt-4">
                <Link to="/app/deals">Browse more deals</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Redemption code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="PRK-XXXXXXXX"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deal ID</Label>
                  <Input
                    value={dealId}
                    onChange={(e) => setDealId(e.target.value)}
                    placeholder="Deal UUID"
                    required
                  />
                  {deal && (
                    <p className="text-xs text-muted-foreground">
                      Redeeming: <span className="font-medium">{deal.title}</span>
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={redeem.isPending}>
                  {redeem.isPending ? "Redeeming…" : "Redeem deal"}
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Need a code? Browse{" "}
              <Link to="/app/deals" className="text-primary hover:underline">
                available deals
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
