import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, calibrationRecords, equipment } from "@/db/schema";
import { logActivity } from "@/server/activity";
import { actorFor, type Actor } from "@/server/actor";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** The member behind a server route's request, or the response refusing it. */
export async function memberOf(request: Request): Promise<Actor | Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return Response.json({ error: "Sign in through your Gateway." }, { status: 401 });
  return actorFor(user);
}

export async function upload(actor: Actor, form: FormData): Promise<Response> {
  if (!actor.canEdit) return Response.json({ error: "Viewers can't upload files." }, { status: 403 });
  const equipmentId = String(form.get("equipmentId") ?? "");
  const recordId = form.get("recordId") ? String(form.get("recordId")) : null;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "Files can be up to 20 MB." }, { status: 413 });
  const [item] = await db.select({ code: equipment.code }).from(equipment).where(eq(equipment.id, equipmentId));
  if (!item) return Response.json({ error: "No such equipment." }, { status: 404 });
  if (recordId) {
    const [record] = await db
      .select({ id: calibrationRecords.id })
      .from(calibrationRecords)
      .where(and(eq(calibrationRecords.id, recordId), eq(calibrationRecords.equipmentId, equipmentId)));
    if (!record) return Response.json({ error: "No such record." }, { status: 404 });
  }
  const id = crypto.randomUUID();
  const key = `equipment/${equipmentId}/${id}`;
  const contentType = file.type || "application/octet-stream";
  const fileName = file.name.replace(/[\r\n"\\/]/g, "_").slice(0, 200) || "file";
  await env.files.put(key, file.stream(), { httpMetadata: { contentType } });
  await db.batch([
    db.insert(attachments).values({ id, equipmentId, recordId, fileName, contentType, size: file.size, key, uploadedBy: actor.email }),
    logActivity(actor, recordId ? "Attached report" : "Attached file", `${fileName} · ${item.code}`, `/equipment/${equipmentId}`),
  ]);
  return Response.json({ id, fileName }, { status: 201 });
}

export async function download(id: string): Promise<Response> {
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  const object = await env.files.get(row.key);
  if (!object) return new Response("Not found", { status: 404 });
  const inline = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(row.contentType);
  return new Response(object.body, {
    headers: {
      "content-type": row.contentType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${row.fileName}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
