CREATE TABLE "sprints" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "domain_id" text,
  "name" text NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "goal" text,
  "start_date" timestamp,
  "end_date" timestamp,
  "capacity_notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_items" (
  "id" text PRIMARY KEY NOT NULL,
  "sprint_id" text NOT NULL,
  "task_id" text,
  "thread_id" text,
  "commitment_status" text DEFAULT 'planned' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "added_by" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_items" ADD CONSTRAINT "sprint_items_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_items" ADD CONSTRAINT "sprint_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_items" ADD CONSTRAINT "sprint_items_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sprints_user_idx" ON "sprints" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sprints_domain_idx" ON "sprints" USING btree ("domain_id");
--> statement-breakpoint
CREATE INDEX "sprints_status_idx" ON "sprints" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sprint_items_sprint_idx" ON "sprint_items" USING btree ("sprint_id");
--> statement-breakpoint
CREATE INDEX "sprint_items_task_idx" ON "sprint_items" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "sprint_items_thread_idx" ON "sprint_items" USING btree ("thread_id");
