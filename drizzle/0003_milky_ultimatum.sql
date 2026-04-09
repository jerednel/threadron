CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "user_id" text NOT NULL DEFAULT 'system';--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "user_id" text NOT NULL DEFAULT 'system';--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
-- Rebuild config table with new primary key and user_id column
ALTER TABLE "config" DROP CONSTRAINT IF EXISTS "config_pkey";--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "user_id" text NOT NULL DEFAULT 'system';--> statement-breakpoint
UPDATE "config" SET "id" = 'cfg_migrate_' || "key";--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_pkey" PRIMARY KEY ("id");--> statement-breakpoint
CREATE INDEX "agents_user_idx" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "config_user_key_idx" ON "config" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "domains_user_idx" ON "domains" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_user_key_unique" UNIQUE("user_id","key");
