import type { RedemptionCode } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";

export async function listRedemptionCodes(filter?: { brandId?: string; dealId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filter?.brandId) params.set("brandId", filter.brandId);
  if (filter?.dealId) params.set("dealId", filter.dealId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return apiClient<RedemptionCode[]>(`/redemption-codes${qs ? `?${qs}` : ""}`);
}

export async function createRedemptionCode(payload: {
  dealId: string;
  maxUses?: number;
  expiresAt?: string;
}) {
  return apiClient<RedemptionCode>("/redemption-codes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRedemptionCode(code: string, payload: Partial<RedemptionCode>) {
  return apiClient<RedemptionCode>(`/redemption-codes/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRedemptionCode(code: string) {
  await apiClient(`/redemption-codes/${encodeURIComponent(code)}`, { method: "DELETE" });
}
