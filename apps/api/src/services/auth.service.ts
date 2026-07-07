import type { Db } from "../db/client";
import * as profilesRepo from "../repositories/profiles.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

interface ClerkUserEventData {
  id: string;
  email_addresses: { email_address: string; id: string }[];
  first_name: string | null;
  last_name: string | null;
  public_metadata?: Record<string, unknown>;
}

export async function handleUserCreated(db: Db, eventData: ClerkUserEventData) {
  const { id, first_name, last_name, public_metadata } = eventData;
  const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

  await profilesRepo.createProfile(db, { id, fullName });
  await userRolesRepo.addRole(db, id, "consumer");

  const intendedRole = public_metadata?.intended_role as string | undefined;
  if (intendedRole === "brand" || intendedRole === "brand_partner") {
    await userRolesRepo.addRole(db, id, "brand_partner");
  }
}

export async function handleUserUpdated(db: Db, eventData: Pick<ClerkUserEventData, "id" | "first_name" | "last_name">) {
  const { id, first_name, last_name } = eventData;
  const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;
  await profilesRepo.updateProfile(db, id, { fullName });
}

export async function handleUserDeleted(db: Db, eventData: { id: string }) {
  const { id } = eventData;
  // soft-delete: clear PII but keep record
  await profilesRepo.updateProfile(db, id, { fullName: null, avatarUrl: null });
}
