CREATE TYPE "public"."affiliation_type" AS ENUM('cooperative', 'alumni', 'professional', 'nysc', 'corporate', 'religious', 'union', 'other');--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('consumer', 'brand_partner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."brand_status" AS ENUM('pending', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'invoiced', 'paid');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('percent', 'flat');--> statement-breakpoint
CREATE TYPE "public"."deal_channel" AS ENUM('online', 'instore', 'both');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('draft', 'pending_review', 'published', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed', 'bogo', 'free_item');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'void');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('redeemed', 'expired', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('id_upload', 'email_domain', 'membership_number');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliation_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "affiliation_type" NOT NULL,
	"description" text,
	"verification_methods" "verification_method"[] DEFAULT '{"id_upload"}' NOT NULL,
	"email_domains" text[] DEFAULT '{}' NOT NULL,
	"badge_validity_months" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"cac_number" text,
	"category" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website" text,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"status" "brand_status" DEFAULT 'pending' NOT NULL,
	"commission_type" "commission_type" DEFAULT 'percent' NOT NULL,
	"commission_rate" numeric(6, 3) DEFAULT '10.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"paystack_ref" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"description" text NOT NULL,
	"terms" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target_group_ids" uuid[] DEFAULT '{}' NOT NULL,
	"channel" "deal_channel" DEFAULT 'both' NOT NULL,
	"redemption_url" text,
	"image_url" text,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"total_cap" integer,
	"status" "deal_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"membership_number" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"phone" text,
	"state" text,
	"lga" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_deals" (
	"user_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_deals_user_id_deal_id_pk" PRIMARY KEY("user_id","deal_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"group_id" uuid,
	"redemption_code" text NOT NULL,
	"method" "deal_channel" DEFAULT 'online' NOT NULL,
	"original_price" numeric(12, 2),
	"final_price" numeric(12, 2),
	"discount_applied" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"commission_rate" numeric(6, 3) NOT NULL,
	"commission_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission_status" "commission_status" DEFAULT 'pending' NOT NULL,
	"status" "transaction_status" DEFAULT 'redeemed' NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "transactions_redemption_code_unique" UNIQUE("redemption_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"method" "verification_method" NOT NULL,
	"membership_number" text,
	"id_document_url" text,
	"submitted_email" text,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_whitelist" ADD CONSTRAINT "group_whitelist_group_id_affiliation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."affiliation_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_deals" ADD CONSTRAINT "saved_deals_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_affiliation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."affiliation_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_group_id_affiliation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."affiliation_groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_whitelist_group_id_membership_number_index" ON "group_whitelist" USING btree ("group_id","membership_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_index" ON "user_roles" USING btree ("user_id","role");