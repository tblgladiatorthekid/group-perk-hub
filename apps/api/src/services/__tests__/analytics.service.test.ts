import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/client", () => ({ db: {} }));
vi.mock("../../repositories/analytics.repo", () => ({
  getMonthlyCommissionAggregates: vi.fn(),
  getBrandCommissionAggregates: vi.fn(),
  getStatusCommissionAggregates: vi.fn(),
  getCommissionHistogramCounts: vi.fn(),
}));

import * as analyticsRepo from "../../repositories/analytics.repo";
import { getAdminAnalytics } from "../analytics.service";

describe("getAdminAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsRepo.getMonthlyCommissionAggregates).mockResolvedValue([]);
    vi.mocked(analyticsRepo.getBrandCommissionAggregates).mockResolvedValue([]);
    vi.mocked(analyticsRepo.getStatusCommissionAggregates).mockResolvedValue([]);
    vi.mocked(analyticsRepo.getCommissionHistogramCounts).mockResolvedValue([]);
  });

  it("zero-fills all 12 months in Jan-Dec order, converting amounts to numbers", async () => {
    vi.mocked(analyticsRepo.getMonthlyCommissionAggregates).mockResolvedValue([
      { month: 3, transactionCount: 5, commissionAmount: "1500.00" },
      { month: 1, transactionCount: 2, commissionAmount: "300.50" },
    ]);

    const result = await getAdminAnalytics({} as any, 2026);

    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0]).toEqual({ month: 1, transactionCount: 2, commissionAmount: 300.5 });
    expect(result.monthly[1]).toEqual({ month: 2, transactionCount: 0, commissionAmount: 0 });
    expect(result.monthly[2]).toEqual({ month: 3, transactionCount: 5, commissionAmount: 1500 });
    expect(result.monthly[11]).toEqual({ month: 12, transactionCount: 0, commissionAmount: 0 });
  });

  it("preserves repo ordering for byBrand and converts amounts to numbers", async () => {
    vi.mocked(analyticsRepo.getBrandCommissionAggregates).mockResolvedValue([
      { brandId: "b1", brandName: "Chicken Republic", commissionAmount: "9000.00" },
      { brandId: "b2", brandName: "Jumia", commissionAmount: "4200.75" },
    ]);

    const result = await getAdminAnalytics({} as any, 2026);

    expect(result.byBrand).toEqual([
      { brandId: "b1", brandName: "Chicken Republic", commissionAmount: 9000 },
      { brandId: "b2", brandName: "Jumia", commissionAmount: 4200.75 },
    ]);
  });

  it("zero-fills commission statuses missing from the data, in pending/invoiced/paid order", async () => {
    vi.mocked(analyticsRepo.getStatusCommissionAggregates).mockResolvedValue([
      { status: "paid", commissionAmount: "12000.00" },
    ]);

    const result = await getAdminAnalytics({} as any, 2026);

    expect(result.byStatus).toEqual([
      { status: "pending", commissionAmount: 0 },
      { status: "invoiced", commissionAmount: 0 },
      { status: "paid", commissionAmount: 12000 },
    ]);
  });

  it("zero-fills histogram buckets missing from the data, in ascending bucket order regardless of repo order", async () => {
    vi.mocked(analyticsRepo.getCommissionHistogramCounts).mockResolvedValue([
      { bucket: "25k+", count: 1 },
      { bucket: "0-1k", count: 10 },
    ]);

    const result = await getAdminAnalytics({} as any, 2026);

    expect(result.histogram).toEqual([
      { bucket: "0-1k", count: 10 },
      { bucket: "1k-5k", count: 0 },
      { bucket: "5k-10k", count: 0 },
      { bucket: "10k-25k", count: 0 },
      { bucket: "25k+", count: 1 },
    ]);
  });
});
