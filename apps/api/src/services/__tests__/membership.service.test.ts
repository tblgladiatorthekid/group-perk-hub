import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/client", () => ({ db: {} }));
vi.mock("../../repositories/groups.repo", () => ({ getGroup: vi.fn() }));
vi.mock("../../repositories/whitelist.repo", () => ({ whitelistEntryExists: vi.fn() }));
vi.mock("../../repositories/memberships.repo", () => ({ createMembership: vi.fn() }));

import * as groupsRepo from "../../repositories/groups.repo";
import * as whitelistRepo from "../../repositories/whitelist.repo";
import * as membershipsRepo from "../../repositories/memberships.repo";
import { createAndAutoVerify } from "../membership.service";

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      getUser: vi.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: "test@unilag.edu.ng" }],
      }),
    },
  }),
}));

describe("createAndAutoVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should auto-verify via email domain match", async () => {
    vi.mocked(groupsRepo.getGroup).mockResolvedValue({
      id: "group-1",
      emailDomains: ["unilag.edu.ng"],
      badgeValidityMonths: 24,
      verificationMethods: ["email_domain"],
      active: true,
      name: "UNILAG Alumni",
      type: "alumni",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(membershipsRepo.createMembership).mockResolvedValue({
      id: "mem-1",
      userId: "user-1",
      groupId: "group-1",
      method: "email_domain",
      status: "verified",
      verifiedAt: new Date(),
      expiresAt: new Date(),
      membershipNumber: null,
      idDocumentUrl: null,
      submittedEmail: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createAndAutoVerify({} as any, {
      userId: "user-1",
      groupId: "group-1",
      method: "email_domain",
    });

    expect(result.status).toBe("verified");
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("should create pending membership when no match", async () => {
    vi.mocked(groupsRepo.getGroup).mockResolvedValue({
      id: "group-3",
      emailDomains: [],
      badgeValidityMonths: 12,
      verificationMethods: ["id_upload"],
      active: true,
      name: "Some Group",
      type: "professional",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(membershipsRepo.createMembership).mockResolvedValue({
      id: "mem-3",
      userId: "user-3",
      groupId: "group-3",
      method: "id_upload",
      status: "pending",
      verifiedAt: null,
      expiresAt: null,
      membershipNumber: null,
      idDocumentUrl: null,
      submittedEmail: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createAndAutoVerify({} as any, {
      userId: "user-3",
      groupId: "group-3",
      method: "id_upload",
    });

    expect(result.status).toBe("pending");
  });
});
