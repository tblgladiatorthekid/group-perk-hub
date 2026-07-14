import { db } from "./db/client";
import { deals, brands, affiliationGroups } from "./db/schema";
import { eq } from "drizzle-orm";
import type { DealChannel, DiscountType } from "@perkhub/shared";

const inNDays = (n: number) => new Date(Date.now() + n * 86400000);

async function seed() {
  const allBrands = await db.select().from(brands);
  const allGroups = await db.select().from(affiliationGroups);

  const brandByName = new Map(allBrands.map((b) => [b.name, b]));
  const groupByName = new Map(allGroups.map((g) => [g.name, g]));

  const nysc = groupByName.get("NYSC Corps Members");
  const unilag = groupByName.get("University of Lagos Alumni");
  const ican = groupByName.get("ICAN — Chartered Accountants");
  const nba = groupByName.get("Nigerian Bar Association");

  if (!nysc || !unilag || !ican || !nba) {
    throw new Error("Expected seed groups not found — run seed.ts first");
  }

  const seedDeals: {
    brandName: string;
    title: string;
    description: string;
    terms: string;
    discountType: DiscountType;
    discountValue: string;
    targetGroupIds: string[];
    channel: DealChannel;
    redemptionUrl: string | null;
    endInDays: number;
  }[] = [
    {
      brandName: "Kuda Bank",
      title: "Zero transfer fees for 3 months",
      description: "Open a Kuda account and get unlimited free transfers for your first 3 months.",
      terms: "New Kuda accounts only. Offer applies to transfers within Nigeria.",
      discountType: "free_item",
      discountValue: "0",
      targetGroupIds: [ican.id, nba.id],
      channel: "online",
      redemptionUrl: "https://kuda.example.com/perkhub",
      endInDays: 60,
    },
    {
      brandName: "Chicken Republic",
      title: "20% off any combo meal",
      description: "Show your PerkHub badge in-store for 20% off any combo meal, any branch nationwide.",
      terms: "Dine-in and takeout only. Not valid with other promotions.",
      discountType: "percent",
      discountValue: "20",
      targetGroupIds: [nysc.id],
      channel: "instore",
      redemptionUrl: null,
      endInDays: 45,
    },
    {
      brandName: "Genesis Cinemas",
      title: "Buy one ticket, get one free",
      description: "Verified members get a free second ticket on all standard screenings, Mon–Thu.",
      terms: "Valid Monday to Thursday only. Excludes premiere screenings.",
      discountType: "bogo",
      discountValue: "0",
      targetGroupIds: [unilag.id, nysc.id],
      channel: "instore",
      redemptionUrl: null,
      endInDays: 30,
    },
    {
      brandName: "MTN Nigeria",
      title: "₦1,000 off any data bundle",
      description: "Get ₦1,000 off any data bundle purchase of ₦5,000 or more via the MTN app.",
      terms: "One redemption per user per month.",
      discountType: "fixed",
      discountValue: "1000",
      targetGroupIds: [ican.id, nba.id, unilag.id],
      channel: "online",
      redemptionUrl: "https://mtn.example.com/perkhub",
      endInDays: 90,
    },
    {
      brandName: "Shoprite Nigeria",
      title: "10% off your first shop",
      description: "New PerkHub members get 10% off their first in-store purchase over ₦10,000.",
      terms: "First redemption only. Excludes airtime and gift cards.",
      discountType: "percent",
      discountValue: "10",
      targetGroupIds: [nysc.id, unilag.id, ican.id, nba.id],
      channel: "both",
      redemptionUrl: null,
      endInDays: 75,
    },
  ];

  console.log("Seeding deals...");
  for (const d of seedDeals) {
    const brand = brandByName.get(d.brandName);
    if (!brand) {
      console.warn(`Skipping "${d.title}" — brand "${d.brandName}" not found`);
      continue;
    }
    const existing = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.title, d.title))
      .limit(1);
    if (existing.length > 0) {
      console.log(`Already seeded: ${d.title}`);
      continue;
    }
    await db.insert(deals).values({
      brandId: brand.id,
      title: d.title,
      description: d.description,
      terms: d.terms,
      discountType: d.discountType,
      discountValue: d.discountValue,
      targetGroupIds: d.targetGroupIds,
      channel: d.channel,
      redemptionUrl: d.redemptionUrl,
      startDate: new Date(),
      endDate: inNDays(d.endInDays),
      perUserLimit: 1,
      status: "published",
    });
    console.log(`Seeded: ${d.title}`);
  }
  console.log("Seed complete");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
