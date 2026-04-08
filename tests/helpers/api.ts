import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema.js";
import { sql } from "drizzle-orm";

const TEST_DB_URL = process.env.TEST_DATABASE_URL || "postgres://tfa:tfa@localhost:5432/tfa_test";

export async function createTestContext() {
  const client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  await db.execute(sql`TRUNCATE api_keys, context_entries, tasks, projects, domains, agents, config CASCADE`);
  return { db, client };
}
