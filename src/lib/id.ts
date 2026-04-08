import { nanoid } from "nanoid";

export function genId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}
