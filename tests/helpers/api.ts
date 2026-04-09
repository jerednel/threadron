import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema.js";
import { sql } from "drizzle-orm";
import { genId } from "../../src/lib/id.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL || "postgres://tfa:tfa@localhost:5432/tfa_test";

export const TEST_USER_ID = "test-user-1";

export async function createTestContext() {
  const client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  await db.execute(sql`TRUNCATE users, api_keys, artifacts, context_entries, tasks, projects, domains, agents, config, waitlist CASCADE`);

  // Create a default test user so tests that need a userId have one
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    email: "test@example.com",
    passwordHash: "not-a-real-hash",
    name: "Test User",
  });

  return { db, client, userId: TEST_USER_ID };
}
