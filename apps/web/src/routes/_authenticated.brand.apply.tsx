import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import type { Brand } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatPhoneNG } from "@/lib/format";

const CATEGORIES = [
  "Food & Drink",
  "Fashion",
  "Beauty & Wellness",
  "Health & Pharmacy",
  "Travel & Hospitality",
  "Fitness",
  "Electronics",
  "Home & Living",
  "Education",
  "Financial Services",
  "Entertainment",
  "Automotive",
  "Other",
];

const schema = z.object({
  name: z.string().min(2, "Brand name is required"),
  category: z.string().min(1, "Pick a category"),
  cacNumber: z.string().optional(),
  website: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
  contactEmail: z.string().email("Enter a valid email"),
  contactPhone: z.string().optional(),
  description: z.string().max(600).optional(),
  commissionType: z.enum(["percent", "flat"]).default("percent"),
  commissionRate: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/brand/apply")({
  component: BrandApply,
});

function BrandApply() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existing
      ? {
          name: existing.name,
          category: existing.category,
          cacNumber: existing.cacNumber ?? "",
          website: existing.website ?? "",
          contactEmail: existing.contactEmail,
          contactPhone: existing.contactPhone ?? "",
          description: existing.description ?? "",
          commissionType: existing.commissionType,
          commissionRate: Number(existing.commissionRate),
        }
      : {
          name: "",
          category: "",
          cacNumber: "",
          website: "",
          contactEmail: "",
          contactPhone: "",
          description: "",
          commissionType: "percent",
          commissionRate: 10,
        },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        ...values,
        contactPhone: values.contactPhone ? formatPhoneNG(values.contactPhone) : null,
        website: values.website || null,
        cacNumber: values.cacNumber || null,
        description: values.description || null,
      };
      if (existing) {
        return apiClient<Brand>(`/brands/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiClient<Brand>("/brands", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["my-brand"] });
      toast.success(existing ? "Business profile updated" : "Application submitted for review");
      if (!existing) navigate({ to: "/brand" });
      else if (b) form.reset();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardShell
      title={existing ? "Business profile" : "Brand application"}
      subtitle={
        existing
          ? "Update your business details. Status changes require admin review."
          : "Tell us about your business. PerkHub admins review every application before you can publish deals."
      }
      nav={[{ to: "/brand", label: "Back to overview", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent={existing ? existing.status : "New application"}
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <form
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <Field label="Brand name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} placeholder="e.g. Chicken Republic" />
          </Field>

          <Field label="Category" error={form.formState.errors.category?.message}>
            <Select
              value={form.watch("category")}
              onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="CAC number (optional)">
              <Input {...form.register("cacNumber")} placeholder="RC 123456" />
            </Field>
            <Field label="Website (optional)" error={form.formState.errors.website?.message}>
              <Input {...form.register("website")} placeholder="https://" />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contact email" error={form.formState.errors.contactEmail?.message}>
              <Input type="email" {...form.register("contactEmail")} />
            </Field>
            <Field label="Contact phone (Nigeria)">
              <Input {...form.register("contactPhone")} placeholder="0801 234 5678" />
            </Field>
          </div>

          <Field label="About your business (optional)">
            <Textarea rows={4} {...form.register("description")} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Commission type">
              <Select
                value={form.watch("commissionType")}
                onValueChange={(v: "percent" | "flat") =>
                  form.setValue("commissionType", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent of transaction</SelectItem>
                  <SelectItem value="flat">Flat naira per redemption</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={
                form.watch("commissionType") === "percent"
                  ? "Commission rate (%)"
                  : "Commission (₦ per redemption)"
              }
              error={form.formState.errors.commissionRate?.message}
            >
              <Input type="number" step="0.5" {...form.register("commissionRate")} />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost">
              <Link to="/brand">Cancel</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : existing ? "Save changes" : "Submit application"}
            </Button>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
