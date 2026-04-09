CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"type" text NOT NULL,
	"uri" text,
	"body" text,
	"title" text,
	"created_by" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "context_entries" ADD COLUMN "actor_type" text DEFAULT 'agent' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "current_state" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "blockers" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "outcome_definition" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "claim_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_task_idx" ON "artifacts" USING btree ("task_id");