import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";

// Domains
export const domains = pgTable("domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  defaultGuardrail: text("default_guardrail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("domains_user_idx").on(t.userId)]);

// Projects
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("projects_domain_idx").on(table.domainId)]
);

// Tasks
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: text("status").notNull().default("pending"),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    assignee: text("assignee"),
    createdBy: text("created_by").notNull(),
    priority: text("priority").notNull().default("medium"),
    guardrail: text("guardrail"),
    dependencies: jsonb("dependencies"),
    dueDate: timestamp("due_date"),
    tags: jsonb("tags"),
    metadata: jsonb("metadata"),
    // Work item / agent execution state fields
    goal: text("goal"),
    currentState: text("current_state"),
    nextAction: text("next_action"),
    blockers: jsonb("blockers").$type<string[]>().default([]),
    outcomeDefinition: text("outcome_definition"),
    confidence: text("confidence"),
    claimedBy: text("claimed_by"),
    claimExpiresAt: timestamp("claim_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasks_domain_idx").on(table.domainId),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_assignee_idx").on(table.assignee),
    index("tasks_status_idx").on(table.status),
  ]
);

// Context Entries
export const contextEntries = pgTable(
  "context_entries",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    body: text("body").notNull(),
    author: text("author").notNull(),
    actorType: text("actor_type").notNull().default("agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("context_entries_task_idx").on(table.taskId)]
);

// Artifacts
export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    uri: text("uri"),
    body: text("body"),
    title: text("title"),
    createdBy: text("created_by").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("artifacts_task_idx").on(t.taskId)]
);

// Agents
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  userId: text("user_id").notNull(),
  capabilities: jsonb("capabilities"),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("agents_user_idx").on(t.userId)]);

// API Keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    agentId: text("agent_id"),
    userId: text("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("api_keys_key_idx").on(table.key)]
);

// Config
export const config = pgTable("config", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  userId: text("user_id").notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("config_user_key_idx").on(t.userId, t.key),
  unique("config_user_key_unique").on(t.userId, t.key),
]);

// Waitlist
export const waitlist = pgTable("waitlist", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
