import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  attachments,
  calibrationRecords,
  equipment,
  recordPoints,
  workspace,
} from "@/db/schema";
import { formatCert, pointPasses } from "@/lib/calibration";
import { logActivity } from "@/server/activity";
import { Refusal, requireEditor, WORKSPACE_ID, type Actor } from "@/server/actor";
import { syncFromRecords } from "@/server/equipment";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().finite().nullable(),
);

const point = z
  .object({
    nominal: z.coerce.number().finite(),
    measured: z.coerce.number().finite(),
    lower: z.coerce.number().finite(),
    upper: z.coerce.number().finite(),
  })
  .strict()
  .refine((p) => p.lower <= p.upper, "Lower limit must not exceed upper limit");

export const recordInput = z
  .object({
    id: z.string().uuid().optional(),
    equipmentId: z.string().uuid(),
    calDate: date,
    technician: z.string().trim().min(1, "Technician is required").max(120),
    procedure: z.string().trim().max(300).default(""),
    temperature: optionalNumber,
    temperatureUnit: z.enum(["C", "F"]).default("C"),
    humidity: optionalNumber.refine((h) => h === null || (h >= 0 && h <= 100), "Humidity is a percentage"),
    points: z.array(point).max(100),
    result: z.enum(["pass", "fail"]),
    adjusted: z.boolean().default(false),
    notes: z.string().trim().max(4000).default(""),
  })
  .strict();

export const recordFilters = z
  .object({
    equipmentId: z.string().uuid().optional(),
    result: z.enum(["pass", "fail"]).optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .strict();

function shortCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function pointRows(recordId: string, points: z.infer<typeof point>[]) {
  return points.map((p, position) => ({
    id: crypto.randomUUID(),
    recordId,
    position,
    ...p,
    pass: pointPasses(p),
  }));
}

export async function saveRecord(
  actor: Actor,
  input: z.infer<typeof recordInput>,
): Promise<{ id: string }> {
  requireEditor(actor);
  const { id: givenId, points, ...fields } = input;
  const [item] = await db
    .select({ code: equipment.code, name: equipment.name })
    .from(equipment)
    .where(eq(equipment.id, fields.equipmentId));
  if (!item) throw new Refusal("That equipment no longer exists.", 404);
  const now = new Date().toISOString();

  if (givenId) {
    const [existing] = await db
      .select({ equipmentId: calibrationRecords.equipmentId, certNumber: calibrationRecords.certNumber })
      .from(calibrationRecords)
      .where(eq(calibrationRecords.id, givenId));
    if (!existing) throw new Refusal("That record no longer exists.", 404);
    if (existing.equipmentId !== fields.equipmentId) throw new Refusal("A record stays with its equipment.", 400);
    const rows = pointRows(givenId, points);
    await db.batch([
      db
        .update(calibrationRecords)
        .set({ ...fields, updatedBy: actor.email, updatedAt: now })
        .where(eq(calibrationRecords.id, givenId)),
      db.delete(recordPoints).where(eq(recordPoints.recordId, givenId)),
      ...(rows.length ? [db.insert(recordPoints).values(rows)] : []),
      syncFromRecords(fields.equipmentId),
      logActivity(actor, "Updated calibration", `${formatCert(existing.certNumber)} · ${item.code}`, `/records/${givenId}`),
    ]);
    return { id: givenId };
  }

  const id = crypto.randomUUID();
  const rows = pointRows(id, points);
  // The counter moves and the record takes its value in one batch, so each
  // number is issued once.
  await db.batch([
    db
      .update(workspace)
      .set({ certCounter: sql`${workspace.certCounter} + 1` })
      .where(eq(workspace.id, WORKSPACE_ID)),
    db.insert(calibrationRecords).values({
      id,
      ...fields,
      certNumber: sql`(select cert_counter from workspace where id = ${WORKSPACE_ID})`,
      shortCode: shortCode(),
      createdBy: actor.email,
    }),
    ...(rows.length ? [db.insert(recordPoints).values(rows)] : []),
    syncFromRecords(fields.equipmentId),
    logActivity(
      actor,
      fields.result === "pass" ? "Recorded calibration (pass)" : "Recorded calibration (fail)",
      item.code,
      `/records/${id}`,
    ),
  ]);
  return { id };
}

const listed = {
  id: calibrationRecords.id,
  certNumber: calibrationRecords.certNumber,
  calDate: calibrationRecords.calDate,
  technician: calibrationRecords.technician,
  procedure: calibrationRecords.procedure,
  result: calibrationRecords.result,
  adjusted: calibrationRecords.adjusted,
  temperature: calibrationRecords.temperature,
  temperatureUnit: calibrationRecords.temperatureUnit,
  humidity: calibrationRecords.humidity,
  equipmentId: calibrationRecords.equipmentId,
  equipmentCode: equipment.code,
  equipmentName: equipment.name,
  intervalDays: equipment.intervalDays,
};

export function listRecords(filters: z.infer<typeof recordFilters>) {
  const where: SQL[] = [];
  if (filters.equipmentId) where.push(eq(calibrationRecords.equipmentId, filters.equipmentId));
  if (filters.result) where.push(eq(calibrationRecords.result, filters.result));
  if (filters.from) where.push(gte(calibrationRecords.calDate, filters.from));
  if (filters.to) where.push(lte(calibrationRecords.calDate, filters.to));
  return db
    .select(listed)
    .from(calibrationRecords)
    .innerJoin(equipment, eq(equipment.id, calibrationRecords.equipmentId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(calibrationRecords.calDate), desc(calibrationRecords.certNumber))
    .limit(2000);
}

async function fullRecord(where: SQL) {
  const [record] = await db.select().from(calibrationRecords).where(where);
  if (!record) return null;
  const [[item], points, [ws]] = await Promise.all([
    db.select().from(equipment).where(eq(equipment.id, record.equipmentId)),
    db.select().from(recordPoints).where(eq(recordPoints.recordId, record.id)).orderBy(asc(recordPoints.position)),
    db.select({ companyName: workspace.companyName, disclaimer: workspace.disclaimer }).from(workspace).where(eq(workspace.id, WORKSPACE_ID)),
  ]);
  return { record, item: item!, points, company: ws ?? { companyName: "", disclaimer: "" } };
}

export async function getRecord(id: string) {
  const found = await fullRecord(eq(calibrationRecords.id, id));
  if (!found) return null;
  const files = await db
    .select({ id: attachments.id, fileName: attachments.fileName, size: attachments.size })
    .from(attachments)
    .where(eq(attachments.recordId, id));
  return { ...found, files };
}

/** What a certificate shows: no notes, no files, no member emails. */
export async function getCertificate(where: { id: string } | { code: string }) {
  const found = await fullRecord(
    "id" in where ? eq(calibrationRecords.id, where.id) : eq(calibrationRecords.shortCode, where.code),
  );
  if (!found) return null;
  const { record, item, points, company } = found;
  return {
    record: {
      certNumber: record.certNumber,
      shortCode: record.shortCode,
      calDate: record.calDate,
      technician: record.technician,
      procedure: record.procedure,
      temperature: record.temperature,
      temperatureUnit: record.temperatureUnit,
      humidity: record.humidity,
      result: record.result,
      adjusted: record.adjusted,
      nextDue: addInterval(record.calDate, item.intervalDays),
    },
    item: {
      code: item.code,
      name: item.name,
      serial: item.serial,
      manufacturer: item.manufacturer,
      model: item.model,
      range: item.range,
      referenceStandard: item.referenceStandard,
    },
    points: points.map(({ nominal, measured, lower, upper, pass }) => ({ nominal, measured, lower, upper, pass })),
    company,
  };
}

function addInterval(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
