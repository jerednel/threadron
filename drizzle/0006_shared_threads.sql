CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text,
	"parent_thread_id" text,
	"root_task_id" text,
	"current_task_id" text,
	"current_state" text,
	"next_action" text,
	"blockers" jsonb DEFAULT '[]'::jsonb,
	"outcome_definition" text,
	"confidence" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "threads_user_idx" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_status_idx" ON "threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "threads_source_idx" ON "threads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "threads_parent_idx" ON "threads" USING btree ("parent_thread_id");--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_parent_thread_id_threads_id_fk" FOREIGN KEY ("parent_thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_root_task_id_tasks_id_fk" FOREIGN KEY ("root_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_current_task_id_tasks_id_fk" FOREIGN KEY ("current_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_task_id" text;--> statement-breakpoint
INSERT INTO "threads" ("id", "name", "user_id", "status", "source", "root_task_id", "current_task_id", "current_state", "next_action", "blockers", "outcome_definition", "confidence", "metadata", "created_by", "created_at", "updated_at")
SELECT
	'th_' || t."id" AS "id",
	t."title" AS "name",
	d."user_id" AS "user_id",
	CASE WHEN t."status" = 'closed' THEN 'completed' ELSE t."status" END AS "status",
	NULL AS "source",
	t."id" AS "root_task_id",
	t."id" AS "current_task_id",
	t."current_state" AS "current_state",
	t."next_action" AS "next_action",
	COALESCE(t."blockers", '[]'::jsonb) AS "blockers",
	t."outcome_definition" AS "outcome_definition",
	t."confidence" AS "confidence",
	COALESCE(t."metadata", '{}'::jsonb) AS "metadata",
	t."created_by" AS "created_by",
	t."created_at" AS "created_at",
	t."updated_at" AS "updated_at"
FROM "tasks" t
INNER JOIN "domains" d ON d."id" = t."domain_id";
--> statement-breakpoint
UPDATE "tasks"
SET "thread_id" = 'th_' || "id";
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "thread_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_thread_idx" ON "tasks" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_task_id");
