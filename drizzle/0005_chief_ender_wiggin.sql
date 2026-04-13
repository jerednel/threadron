CREATE TABLE "inbox_items" (
	"id" text PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'unprocessed' NOT NULL,
	"domain_id" text,
	"parsed_title" text,
	"parsed_next_action" text,
	"parsed_project" text,
	"parsed_owner" text,
	"parsed_blockers" jsonb DEFAULT '[]'::jsonb,
	"parsed_confidence" text,
	"promoted_task_id" text,
	"error" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_promoted_task_id_tasks_id_fk" FOREIGN KEY ("promoted_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_items_status_idx" ON "inbox_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inbox_items_created_by_idx" ON "inbox_items" USING btree ("created_by");