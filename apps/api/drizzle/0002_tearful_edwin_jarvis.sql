CREATE TYPE "public"."redemption_code_status" AS ENUM('active', 'used', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "redemption_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "redemption_code_status" DEFAULT 'active' NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "redemption_code_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "redemption_codes" ADD CONSTRAINT "redemption_codes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "redemption_codes" ADD CONSTRAINT "redemption_codes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "redemption_codes_deal_id_code_index" ON "redemption_codes" USING btree ("deal_id","code");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_redemption_code_id_redemption_codes_id_fk" FOREIGN KEY ("redemption_code_id") REFERENCES "public"."redemption_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."user_roles" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."app_role";--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('consumer', 'brand_partner', 'brand_manager', 'super_admin', 'affiliation_admin', 'commerce_admin');--> statement-breakpoint
ALTER TABLE "public"."user_roles" ALTER COLUMN "role" SET DATA TYPE "public"."app_role" USING "role"::"public"."app_role";