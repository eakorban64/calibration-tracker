import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, workspace } from "@/db/schema";

export const WORKSPACE_ID = "default";

export type Role = "admin" | "technician" | "viewer";

export interface Actor {
  id: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  canEdit: boolean;
}

/** A thrown error whose message the page shows as is. */
export class Refusal extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * The verified Gateway user as this app's member: created on first sight
 * with the identity's email. Admin comes from the Gateway; everyone else is
 * a technician or a viewer, as an admin set them.
 */
export async function actorFor(user: EveryAppUser): Promise<Actor> {
  const admin = isAdmin(user);
  const [, , row] = await db.batch([
    db
      .insert(workspace)
      .values({
        id: WORKSPACE_ID,
        orgId: user.orgId,
        companyName: user.orgName ?? "",
        disclaimer:
          "This certificate records the measured results for the equipment named above at the time of calibration. It may only be reproduced in full with the consent of {companyName}.",
      })
      .onConflictDoUpdate({
        target: workspace.id,
        set: { orgId: user.orgId },
        setWhere: sql`${workspace.orgId} is null`,
      }),
    db
      .insert(members)
      .values({ id: user.id, email: user.email, isAdmin: admin })
      .onConflictDoUpdate({ target: members.id, set: { email: user.email, isAdmin: admin } }),
    db.select({ role: members.role }).from(members).where(eq(members.id, user.id)),
  ]);
  const role: Role = admin ? "admin" : row[0]?.role === "viewer" ? "viewer" : "technician";
  return { id: user.id, email: user.email, role, isAdmin: admin, canEdit: role !== "viewer" };
}

export function requireEditor(actor: Actor): void {
  if (!actor.canEdit) throw new Refusal("Viewers can't make changes.");
}

export function requireAdmin(actor: Actor): void {
  if (!actor.isAdmin) throw new Refusal("Only admins can do that.");
}
