CREATE TYPE "public"."deal_duration_type" AS ENUM('one_time', 'monthly', 'half_yearly', 'yearly');--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "duration_type" "public"."deal_duration_type";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "redemption_limit" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "performance_threshold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "performance_check_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "auto_expire_poor_performance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_id_created_at_index" ON "transactions" USING btree ("user_id","created_at" DESC);
