import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Home, Sparkles, Ticket, User, Upload, CheckCircle2, Loader2 } from "lucide-react";
import type { AffiliationGroup, VerificationMethod } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/verify")({
  component: VerifyPage,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app/verify", label: "Verify membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app/membership", label: "My card", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app/deals", label: "Deals", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app", label: "Profile (soon)", icon: <User className="h-4 w-4" /> },
];

function VerifyPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [groupId, setGroupId] = useState<string>("");
  const [method, setMethod] = useState<VerificationMethod | "">("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["affiliation_groups", "active"],
    queryFn: () => apiClient<AffiliationGroup[]>("/groups"),
  });

  const group = useMemo(() => groups?.find((g) => g.id === groupId), [groups, groupId]);
  const availableMethods = group?.verificationMethods ?? [];

  const canSubmit =
    !!groupId &&
    !!method &&
    ((method === "id_upload" && !!file) ||
      (method === "membership_number" && membershipNumber.trim().length > 0) ||
      method === "email_domain");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !group) return;
    setSubmitting(true);
    try {
      let idDocumentUrl: string | null = null;
      if (method === "id_upload" && file) {
        const { uploadUrl, key } = await apiClient<{ uploadUrl: string; key: string }>(
          "/storage/presign-upload",
          {
            method: "POST",
            body: JSON.stringify({
              bucket: "membership-docs",
              fileName: file.name,
              contentType: file.type,
            }),
          },
        );
        const upload = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!upload.ok) throw new Error("Document upload failed");
        idDocumentUrl = key;
      }

      await apiClient("/memberships", {
        method: "POST",
        body: JSON.stringify({
          groupId: group.id,
          method,
          membershipNumber: method === "membership_number" ? membershipNumber.trim() : null,
          idDocumentUrl,
        }),
      });

      await qc.invalidateQueries({ queryKey: ["my-memberships"] });
      toast.success("Submitted", {
        description:
          method === "email_domain"
            ? "If your account email matches this group's domain, you're verified instantly."
            : method === "membership_number"
              ? "If your number is on the group's whitelist, you're verified instantly. Otherwise our team will review."
              : "Your ID document was uploaded. Our team will review shortly.",
      });
      navigate({ to: "/app/membership" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Submission failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="Verify your membership"
      subtitle="One-time verification unlocks every partner deal targeted at your group."
      nav={nav}
      accent="Consumer"
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-semibold">1. Pick your affiliation</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Which cooperative, alumni body, professional association or corps are you a member of?
          </p>
          <Select value={groupId} onValueChange={(v) => { setGroupId(v); setMethod(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select your group" />
            </SelectTrigger>
            <SelectContent>
              {groups?.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="font-medium">{g.name}</span>{" "}
                  <span className="ml-2 text-xs uppercase text-muted-foreground">{g.type}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {group && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">2. How will you prove it?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This group accepts the methods below. Instant verification when possible; otherwise
              our team reviews within 24 hours.
            </p>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as VerificationMethod)} className="gap-3">
              {availableMethods.includes("email_domain") && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-secondary/50">
                  <RadioGroupItem value="email_domain" className="mt-1" />
                  <div>
                    <div className="font-medium">Match my email domain</div>
                    <div className="text-xs text-muted-foreground">
                      Instant verification if your sign-in email ends in{" "}
                      <span className="font-mono">
                        {(group.emailDomains ?? []).map((d) => `@${d}`).join(", ") || "an approved domain"}
                      </span>
                      .
                    </div>
                  </div>
                </label>
              )}
              {availableMethods.includes("membership_number") && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-secondary/50">
                  <RadioGroupItem value="membership_number" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Enter membership number</div>
                    <div className="text-xs text-muted-foreground">
                      Instant if on the group's whitelist, otherwise reviewed manually.
                    </div>
                    {method === "membership_number" && (
                      <div className="mt-3">
                        <Label htmlFor="mnum" className="text-xs">Membership number</Label>
                        <Input
                          id="mnum"
                          value={membershipNumber}
                          onChange={(e) => setMembershipNumber(e.target.value)}
                          placeholder="e.g. NYSC/23A/1234567"
                        />
                      </div>
                    )}
                  </div>
                </label>
              )}
              {availableMethods.includes("id_upload") && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-secondary/50">
                  <RadioGroupItem value="id_upload" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Upload ID document</div>
                    <div className="text-xs text-muted-foreground">
                      Reviewed by our team. JPG, PNG or PDF. Kept private and encrypted.
                    </div>
                    {method === "id_upload" && (
                      <div className="mt-3">
                        <label
                          htmlFor="idfile"
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm hover:bg-secondary"
                        >
                          <Upload className="h-4 w-4" />
                          {file ? file.name : "Choose a file"}
                        </label>
                        <input
                          id="idfile"
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    )}
                  </div>
                </label>
              )}
            </RadioGroup>
          </section>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Your documents are private — only you and PerkHub reviewers can see them.
          </div>
          <Button type="submit" size="lg" disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit for verification
          </Button>
        </div>
      </form>
    </DashboardShell>
  );
}
