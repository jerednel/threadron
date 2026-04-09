import * as schema from "../db/schema.js";
import { genId } from "./id.js";

export async function recordEvent(
  db: any,
  taskId: string,
  type: string,
  body: string,
  actor: string = "system",
  actorType: string = "system"
) {
  await db.insert(schema.contextEntries).values({
    id: genId("ctx"),
    taskId,
    type,
    body,
    author: actor,
    actorType,
  });
}
