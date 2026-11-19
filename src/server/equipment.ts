import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  attachments,
  calibrationRecords,
  cribMovements,
  equipment,
} from "@/db/schema";
import { logActivity } from "@/server/activity";
import { Refusal, requireEditor, type Actor } from "@/server/actor";

const text = (max = 200) => z.string().trim().max(max).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const equipmentInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Name is required").max(200),
    code: z.string().trim().min(1, "Equipment ID is required").max(60),
    serial: text(),
    manufacturer: text(),
    model: text(),
    category: text(100),
    location: text(100),
    owner: text(100),
    ownerEmail: z.union([z.literal(""), z.string().trim().email("Enter an email address")]).default(""),
    range: text(),
    condition: z.enum(["good", "fair", "damaged"]).default("good"),
    intervalDays: z.coerce.number().int().min(1, "Interval must be at least 1 day").max(3650),
    toleranceNotes: text(1000),
    referenceStandard: text(),
    status: z.enum(["active", "out_of_service"]).default("active"),
    nextDueDate: z.union([z.literal(""), date]).default(""),
  })
  .strict();

export type EquipmentRow = typeof equipment.$inferSelect;

/**
 * Sets the item's last calibration, result and next due date from its
 * latest record. Without records, a next due date set by hand stays.
 */
export function syncFromRecords(equipmentId: string) {
  const latest = (column: string) =>
    sql.raw(
      `(select ${column} from calibration_records r where r.equipment_id = equipment.id order by r.cal_date desc, r.created_at desc limit 1)`,
    );
  return db
    .update(equipment)
    .set({
      lastCalDate: sql`${latest("cal_date")}`,
      lastResult: sql`${latest("result")}`,
      nextDueDate: sql`coalesce(${latest("date(r.cal_date, '+' || equipment.interval_days || ' days')")}, equipment.next_due_date)`,
    })
    .where(eq(equipment.id, equipmentId));
}

export function listEquipment() {
  return db.select().from(equipment).orderBy(asc(equipment.code));
}

export async function getEquipment(id: string) {
  const [item] = await db.select().from(equipment).where(eq(equipment.id, id));
  if (!item) return null;
  const [records, movements, files, duplicates] = await Promise.all([
    db
      .select({
        id: calibrationRecords.id,
        certNumber: calibrationRecords.certNumber,
        calDate: calibrationRecords.calDate,
        technician: calibrationRecords.technician,
        result: calibrationRecords.result,
      })
      .from(calibrationRecords)
      .where(eq(calibrationRecords.equipmentId, id))
      .orderBy(desc(calibrationRecords.calDate), desc(calibrationRecords.createdAt)),
    db
      .select()
      .from(cribMovements)
      .where(eq(cribMovements.equipmentId, id))
      .orderBy(desc(cribMovements.createdAt)),
    db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        size: attachments.size,
        recordId: attachments.recordId,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(eq(attachments.equipmentId, id))
      .orderBy(desc(attachments.createdAt)),
    duplicateSerials(item.serial, id),
  ]);
  return { item, records, movements, files, duplicates };
}

/** Codes of other items with the same serial number. */
async function duplicateSerials(serial: string, exceptId?: string): Promise<string[]> {
  if (!serial) return [];
  const rows = await db
    .select({ code: equipment.code })
    .from(equipment)
    .where(
      exceptId
        ? and(eq(equipment.serial, serial), ne(equipment.id, exceptId))
        : eq(equipment.serial, serial),
    );
  return rows.map((r) => r.code);
}

export async function saveEquipment(
  actor: Actor,
  input: z.infer<typeof equipmentInput>,
): Promise<{ id: string; duplicates: string[] }> {
  requireEditor(actor);
  const { id: givenId, nextDueDate, ...fields } = input;
  const [clash] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(eq(equipment.code, fields.code));
  if (clash && clash.id !== givenId) {
    throw new Refusal(`Equipment ID ${fields.code} is already in use.`, 409);
  }
  const id = givenId ?? crypto.randomUUID();
  const link = `/equipment/${id}`;
  const subject = `${fields.code} ${fields.name}`;
  if (givenId) {
    const [existing] = await db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, givenId));
    if (!existing) throw new Refusal("That equipment no longer exists.", 404);
    await db.batch([
      db
        .update(equipment)
        .set({ ...fields, nextDueDate: nextDueDate || null, updatedAt: new Date().toISOString() })
        .where(eq(equipment.id, id)),
      syncFromRecords(id),
      logActivity(actor, "Edited equipment", subject, link),
    ]);
  } else {
    await db.batch([
      db.insert(equipment).values({ id, ...fields, nextDueDate: nextDueDate || null }),
      logActivity(actor, "Added equipment", subject, link),
    ]);
  }
  return { id, duplicates: await duplicateSerials(fields.serial, id) };
}
