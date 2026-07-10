import { db } from "./db/client";
import { affiliationGroups } from "./db/schema";
import type { VerificationMethod } from "@perkhub/shared";

const seedGroups: {
  name: string;
  type: "nysc" | "alumni" | "professional";
  description: string;
  verificationMethods: VerificationMethod[];
  emailDomains: string[];
  badgeValidityMonths: number;
}[] = [
  {
    name: "NYSC Corps Members",
    type: "nysc" as const,
    description: "National Youth Service Corps serving members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 12,
  },
  {
    name: "University of Lagos Alumni",
    type: "alumni" as const,
    description: "UNILAG alumni association",
    verificationMethods: ["id_upload", "email_domain"],
    emailDomains: ["unilag.edu.ng", "alumni.unilag.edu.ng"],
    badgeValidityMonths: 24,
  },
  {
    name: "University of Ibadan Alumni",
    type: "alumni" as const,
    description: "UI alumni association",
    verificationMethods: ["id_upload", "email_domain"],
    emailDomains: ["ui.edu.ng"],
    badgeValidityMonths: 24,
  },
  {
    name: "ICAN — Chartered Accountants",
    type: "professional" as const,
    description: "Institute of Chartered Accountants of Nigeria",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
  {
    name: "Nigerian Bar Association",
    type: "professional" as const,
    description: "NBA members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
  {
    name: "Nigerian Medical Association",
    type: "professional" as const,
    description: "NMA members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
];

async function seed() {
  console.log("Seeding affiliation groups...");
  for (const group of seedGroups) {
    await db.insert(affiliationGroups).values(group).onConflictDoNothing();
  }
  console.log("Seed complete");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
