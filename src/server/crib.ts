import { and, desc, eq, gte, isNotNull, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cribMovements, equipment } from "@/db/schema";
import { checkoutBlock, today } from "@/lib/calibration";
import { logActivity } from "@/server/activity";
import { Refusal, requireEditor, type Actor } from "@/server/actor";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const checkoutInput = z
  .object({
    equipmentId: z.string().uuid(),
    person: z.string().trim().min(1, "Who is taking it?").max(120),
    location: z.string().trim().max(120).default(""),
    expectedReturn: date,
  })
  .strict();

export const checkinInput = z
  .object({
    equipmentId: z.string().uuid(),
    condition: z.enum(["good", "fair", "damaged"]),
  })
  .strict();

export async function checkout(actor: Actor, input: z.infer<typeof checkoutInput>) {
  requireEditor(actor);
  const on = today();
  // One conditional update: it only lands while every rule holds.
  const [moved] = await db
    .update(equipment)
    .set({
      holder: input.person,
      holderLocation: input.location,
      expectedReturn: input.expectedReturn,
      checkedOutAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(equipment.id, input.equipmentId),
        isNull(equipment.holder),
        eq(equipment.status, "active"),
        ne(equipment.condition, "damaged"),
        or(isNull(equipment.lastResult), ne(equipment.lastResult, "fail")),
        or(isNull(equipment.nextDueDate), gte(equipment.nextDueDate, on)),
      ),
    )
    .returning({ code: equipment.code });
  if (!moved) {
    const [item] = await db.select().from(equipment).where(eq(equipment.id, input.equipmentId));
    if (!item) throw new Refusal("That equipment no longer exists.", 404);
    throw new Refusal(`Can't check out: ${(checkoutBlock(item, on) ?? "not available").toLowerCase()}.`, 409);
  }
  await db.batch([
    db.insert(cribMovements).values({
      id: crypto.randomUUID(),
      equipmentId: input.equipmentId,
      kind: "out",
      person: input.person,
      location: input.location,
      expectedReturn: input.expectedReturn,
      byEmail: actor.email,
    }),
    logActivity(actor, "Checked out", `${moved.code} to ${input.person}`, `/equipment/${input.equipmentId}`),
  ]);
}

export async function checkin(actor: Actor, input: z.infer<typeof checkinInput>) {
  requireEditor(actor);
  const [item] = await db
    .select({ code: equipment.code, holder: equipment.holder })
    .from(equipment)
    .where(eq(equipment.id, input.equipmentId));
  if (!item) throw new Refusal("That equipment no longer exists.", 404);
  const [back] = await db
    .update(equipment)
    .set({ holder: null, holderLocation: null, expectedReturn: null, checkedOutAt: null, condition: input.condition })
    .where(and(eq(equipment.id, input.equipmentId), isNotNull(equipment.holder)))
    .returning({ id: equipment.id });
  if (!back) throw new Refusal("It is already in the crib.", 409);
  await db.batch([
    db.insert(cribMovements).values({
      id: crypto.randomUUID(),
      equipmentId: input.equipmentId,
      kind: "in",
      person: item.holder ?? "",
      condition: input.condition,
      byEmail: actor.email,
    }),
    logActivity(actor, "Checked in", `${item.code} from ${item.holder} (${input.condition})`, `/equipment/${input.equipmentId}`),
  ]);
}

export function cribHistory(limit = 100) {
  return db
    .select({
      id: cribMovements.id,
      kind: cribMovements.kind,
      person: cribMovements.person,
      location: cribMovements.location,
      expectedReturn: cribMovements.expectedReturn,
      condition: cribMovements.condition,
      byEmail: cribMovements.byEmail,
      createdAt: cribMovements.createdAt,
      equipmentId: cribMovements.equipmentId,
      code: equipment.code,
      name: equipment.name,
    })
    .from(cribMovements)
    .innerJoin(equipment, eq(equipment.id, cribMovements.equipmentId))
    .orderBy(desc(cribMovements.createdAt))
    .limit(limit);
}
