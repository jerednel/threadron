import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../../src/db/schema.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL || "postgres://tfa:tfa@localhost:5432/tfa_test";

let client: ReturnType<typeof postgres>;

export async function setup() {
  const adminClient = postgres(TEST_DB_URL.replace(/\/[^/]+$/, "/postgres"));
  try {
    await adminClient`CREATE DATABASE tfa_test`;
  } catch {
    // Already exists
  }
  await adminClient.end();

  client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.end();
}

export async function teardown() {
  // Nothing to do — each test creates its own connection via createTestContext()
}
