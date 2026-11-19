import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, workspace } from "@/db/schema";
import { parseEmails, parseOffsets } from "@/lib/calibration";
import { logActivity } from "@/server/activity";
import { Refusal, requireAdmin, WORKSPACE_ID, type Actor } from "@/server/actor";

export const companyInput = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required").max(200),
    disclaimer: z.string().trim().max(2000),
  })
  .strict();

export const remindersInput = z
  .object({
    mode: z.enum(["off", "per_item", "digest"]),
    offsets: z.string().max(200),
    cc: z.string().max(2000),
    weekday: z.coerce.number().int().min(0).max(6),
    recipients: z.string().max(2000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === "per_item" && parseOffsets(v.offsets).length === 0) {
      ctx.addIssue({ code: "custom", message: "Give at least one number of days" });
    }
    if (v.mode === "digest" && parseEmails(v.recipients).length === 0) {
      ctx.addIssue({ code: "custom", message: "Give at least one recipient" });
    }
  });

export const roleInput = z
  .object({ memberId: z.string().min(1), role: z.enum(["technician", "viewer"]) })
  .strict();

export async function getWorkspace() {
  const [row] = await db.select().from(workspace).where(eq(workspace.id, WORKSPACE_ID));
  return row!;
}

export async function saveCompany(actor: Actor, input: z.infer<typeof companyInput>) {
  requireAdmin(actor);
  await db.batch([
    db.update(workspace).set(input).where(eq(workspace.id, WORKSPACE_ID)),
    logActivity(actor, "Changed certificate settings", input.companyName, "/settings"),
  ]);
}

export async function saveReminders(actor: Actor, input: z.infer<typeof remindersInput>) {
  requireAdmin(actor);
  const offsets = parseOffsets(input.offsets);
  await db.batch([
    db
      .update(workspace)
      .set({
        reminderMode: input.mode,
        reminderOffsets: (offsets.length ? offsets : [30, 14, 7, 0]).join(", "),
        reminderCc: parseEmails(input.cc).join(", "),
        digestWeekday: input.weekday,
        digestRecipients: parseEmails(input.recipients).join(", "),
      })
      .where(eq(workspace.id, WORKSPACE_ID)),
    logActivity(actor, "Changed reminder settings", MODE_LABEL[input.mode], "/settings"),
  ]);
}

const MODE_LABEL = { off: "Off", per_item: "Before each due date", digest: "Weekly digest" } as const;

export function listTeam() {
  return db.select().from(members).orderBy(asc(members.email));
}

export async function setRole(actor: Actor, input: z.infer<typeof roleInput>) {
  requireAdmin(actor);
  if (input.memberId === actor.id) throw new Refusal("Your own access comes from the Gateway.", 400);
  const [changed] = await db
    .update(members)
    .set({ role: input.role })
    .where(and(eq(members.id, input.memberId), eq(members.isAdmin, false)))
    .returning({ email: members.email });
  if (!changed) throw new Refusal("Admins' access comes from the Gateway.", 404);
  await logActivity(actor, input.role === "viewer" ? "Made viewer" : "Made technician", changed.email, "/settings").run();
}
