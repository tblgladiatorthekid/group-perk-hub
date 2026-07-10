import type { Db } from "../db/client";
import * as membershipsRepo from "../repositories/memberships.repo";
import * as groupsRepo from "../repositories/groups.repo";
import * as whitelistRepo from "../repositories/whitelist.repo";
import type { CreateMembershipInput } from "../repositories/memberships.repo";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function createAndAutoVerify(db: Db, input: CreateMembershipInput) {
  const group = await groupsRepo.getGroup(db, input.groupId);
  if (!group) throw new Error("Group not found");

  const updateData: Record<string, unknown> = {
    userId: input.userId,
    groupId: input.groupId,
    method: input.method,
    membershipNumber: input.membershipNumber ?? null,
    idDocumentUrl: input.idDocumentUrl ?? null,
    submittedEmail: input.submittedEmail ?? null,
    status: "pending",
  };

  let matched = false;

  // Email domain match
  if (input.method === "email_domain" && group.emailDomains.length > 0) {
    const clerkUser = await clerkClient.users.getUser(input.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase();
      matched = group.emailDomains.map((d) => d.toLowerCase()).includes(domain ?? "");
    }
  }

  // Whitelist match
  if (!matched && input.method === "membership_number" && input.membershipNumber) {
    matched = await whitelistRepo.whitelistEntryExists(db, input.groupId, input.membershipNumber);
  }

  if (matched) {
    updateData.status = "verified";
    updateData.verifiedAt = new Date();
    updateData.expiresAt = new Date(
      (updateData.verifiedAt as Date).getTime() + group.badgeValidityMonths * 30 * 24 * 60 * 60 * 1000,
    );
  }

  const membership = await membershipsRepo.createMembership(db, updateData as any);
  return membership;
}

export async function stampExpiryOnVerification(
  db: Db,
  id: string,
  data: { status: string; rejectionReason?: string | null },
) {
  const existing = await membershipsRepo.getMembership(db, id);
  if (!existing) throw new Error("Membership not found");

  const updateData: Record<string, unknown> = {
    status: data.status,
    rejectionReason: data.rejectionReason ?? null,
  };

  if (data.status === "verified" && existing.status !== "verified") {
    const group = await groupsRepo.getGroup(db, existing.groupId);
    if (group) {
      updateData.verifiedAt = existing.verifiedAt ?? new Date();
      updateData.expiresAt = new Date(
        ((updateData.verifiedAt as Date)).getTime() + group.badgeValidityMonths * 30 * 24 * 60 * 60 * 1000,
      );
    }
  }

  return membershipsRepo.updateMembership(db, id, updateData as any);
}
