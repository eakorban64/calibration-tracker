import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activity } from "@/db/schema";
import type { Actor } from "@/server/actor";

/** The insert for one activity row, to run in the same batch as the change. */
export function logActivity(
  actor: Pick<Actor, "email">,
  action: string,
  subject: string,
  link?: string,
) {
  return db.insert(activity).values({
    id: crypto.randomUUID(),
    userEmail: actor.email,
    action,
    subject,
    link: link ?? null,
  });
}

export function listActivity(limit = 200) {
  return db
    .select()
    .from(activity)
    .orderBy(desc(activity.createdAt), desc(activity.id))
    .limit(limit);
}
