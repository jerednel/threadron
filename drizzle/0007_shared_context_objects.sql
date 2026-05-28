CREATE TABLE "context_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"domain_id" text,
	"thread_id" text,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"created_by" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "context_objects" ADD CONSTRAINT "context_objects_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "context_objects" ADD CONSTRAINT "context_objects_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "context_objects_user_idx" ON "context_objects" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "context_objects_type_idx" ON "context_objects" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "context_objects_status_idx" ON "context_objects" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "context_objects_domain_idx" ON "context_objects" USING btree ("domain_id");
--> statement-breakpoint
CREATE INDEX "context_objects_thread_idx" ON "context_objects" USING btree ("thread_id");
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "promoted_thread_id" text;
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "remembered_object_id" text;
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_promoted_thread_id_threads_id_fk" FOREIGN KEY ("promoted_thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;
