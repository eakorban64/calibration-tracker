import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { equipment } from "@/db/schema";
import { actorFor } from "@/server/actor";
import * as records from "@/server/records";

export const getRecordList = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => records.recordFilters.parse(data))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    const [rows, items] = await Promise.all([
      records.listRecords(data),
      db.select({ id: equipment.id, code: equipment.code, name: equipment.name }).from(equipment).orderBy(asc(equipment.code)),
    ]);
    return { actor, rows, items };
  });

export const getRecordDetail = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    const found = await records.getRecord(data.id);
    // The address a label's QR code opens: this app's own host.
    const origin = new URL(getRequest().url).origin;
    return { actor, found, publicUrl: found ? `${origin}/c/${found.record.shortCode}` : null };
  });

export const getRecordCertificate = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await actorFor(context.user);
    return records.getCertificate({ id: data.id });
  });

export const saveRecord = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => records.recordInput.parse(data))
  .handler(async ({ data, context }) =>
    records.saveRecord(await actorFor(context.user), data),
  );

/** The certificate behind a label's QR code, for anyone holding the code. */
export const getPublicCertificate = createServerFn()
  .validator((data: unknown) =>
    z.object({ code: z.string().regex(/^[a-z0-9]{6,32}$/) }).parse(data),
  )
  .handler(({ data }) => records.getCertificate({ code: data.code }));
