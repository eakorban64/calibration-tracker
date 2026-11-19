import { GatewayRefusalError, sendEmail } from "@every-app/sdk/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { equipment, reminderLog } from "@/db/schema";
import { addDays, daysBetween, parseEmails, parseOffsets, today } from "@/lib/calibration";
import { getWorkspace } from "@/server/settings";

interface DueItem {
  code: string;
  name: string;
  location: string;
  nextDueDate: string;
  daysLeft: number;
}

/** Active items due within the next 7 days, overdue ones included. */
export async function digestItems(on = today()): Promise<DueItem[]> {
  const until = addDays(on, 7);
  const rows = await db
    .select({
      code: equipment.code,
      name: equipment.name,
      location: equipment.location,
      nextDueDate: equipment.nextDueDate,
    })
    .from(equipment)
    .where(eq(equipment.status, "active"));
  return rows
    .filter((r): r is typeof r & { nextDueDate: string } => !!r.nextDueDate && r.nextDueDate <= until)
    .map((r) => ({ ...r, daysLeft: daysBetween(on, r.nextDueDate) }))
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}

function line(i: DueItem): string {
  const when =
    i.daysLeft < 0 ? `${-i.daysLeft} days overdue` : i.daysLeft === 0 ? "due today" : `due in ${i.daysLeft} days`;
  return `${i.code}  ${i.name}${i.location ? ` (${i.location})` : ""}: ${when}, ${i.nextDueDate}`;
}

export function digestMessage(items: DueItem[], appUrl?: string) {
  const body = items.length
    ? items.map(line).join("\n")
    : "Nothing is due in the next 7 days.";
  return {
    subject: `Calibrations due this week: ${items.length}`,
    text: `${body}${appUrl ? `\n\nReports: ${appUrl}/reports` : ""}\n`,
  };
}

/** Sends the digest now, from a member's request. */
export async function sendTestDigest(env: object, recipients: string[], appUrl: string) {
  const items = await digestItems();
  const preview = digestMessage(items, appUrl);
  if (!recipients.length) return { items, preview, sent: false, problem: "Add a recipient first." };
  try {
    await sendEmail({ env, message: { to: recipients, ...preview } });
    return { items, preview, sent: true, problem: null };
  } catch (error) {
    if (!(error instanceof GatewayRefusalError)) throw error;
    return { items, preview, sent: false, problem: refusalSentence(error) };
  }
}

export function refusalSentence(error: GatewayRefusalError): string {
  if (error.code === "integration_not_configured" || error.code === "capability_not_requested") {
    return "Email isn't set up on your Gateway, so nothing was sent.";
  }
  if (error.code === "email_budget_exhausted") return "Today's email allowance is used up. Try again tomorrow.";
  return error.setup ?? `The Gateway didn't send it (${error.code}).`;
}

/**
 * The scheduled run: sends what is due today and records each send so a
 * later run never repeats it. A key is claimed before sending and released
 * when the send fails, so the next run tries again.
 */
export async function runReminders(env: object, now = new Date()): Promise<number> {
  const ws = await getWorkspace().catch(() => null);
  if (!ws || ws.reminderMode === "off" || !ws.orgId) return 0;
  const on = today(now);
  const target = { background: true as const, organizationId: ws.orgId };
  const jobs: { key: string; to: string[]; subject: string; text: string }[] = [];

  if (ws.reminderMode === "digest") {
    if (now.getUTCDay() !== ws.digestWeekday) return 0;
    const items = await digestItems(on);
    const to = parseEmails(ws.digestRecipients);
    if (!items.length || !to.length) return 0;
    jobs.push({ key: `digest:${on}`, to, ...digestMessage(items) });
  } else {
    const offsets = parseOffsets(ws.reminderOffsets);
    const cc = parseEmails(ws.reminderCc);
    for (const item of await digestItemsAll(on)) {
      const to = [...new Set([...parseEmails(item.ownerEmail), ...cc])];
      if (!to.length) continue;
      if (item.daysLeft < 0) {
        jobs.push({
          key: `overdue:${item.id}:${on}`,
          to,
          subject: `Overdue for calibration: ${item.code}`,
          text: `${line(item)}\n`,
        });
      } else if (offsets.includes(item.daysLeft)) {
        jobs.push({
          key: `due:${item.id}:${item.nextDueDate}:${item.daysLeft}`,
          to,
          subject: `Calibration ${item.daysLeft === 0 ? "due today" : `due in ${item.daysLeft} days`}: ${item.code}`,
          text: `${line(item)}\n`,
        });
      }
    }
  }

  let sent = 0;
  for (const job of jobs) {
    const [claimed] = await db
      .insert(reminderLog)
      .values({ key: job.key, recipients: job.to.join(", ") })
      .onConflictDoNothing()
      .returning({ key: reminderLog.key });
    if (!claimed) continue;
    try {
      await sendEmail({ env, for: target, message: { to: job.to, subject: job.subject, text: job.text } });
      sent++;
    } catch (error) {
      await db.delete(reminderLog).where(eq(reminderLog.key, job.key));
      if (error instanceof GatewayRefusalError) {
        console.warn(`Reminder not sent: ${error.code}`);
        // Not set up or over budget: the rest would be refused too.
        if (error.code !== "email_invalid_message") break;
        continue;
      }
      throw error;
    }
  }
  return sent;
}

async function digestItemsAll(on: string) {
  const rows = await db
    .select({
      id: equipment.id,
      code: equipment.code,
      name: equipment.name,
      location: equipment.location,
      ownerEmail: equipment.ownerEmail,
      nextDueDate: equipment.nextDueDate,
    })
    .from(equipment)
    .where(eq(equipment.status, "active"));
  return rows
    .filter((r): r is typeof r & { nextDueDate: string } => !!r.nextDueDate)
    .map((r) => ({ ...r, daysLeft: daysBetween(on, r.nextDueDate) }));
}
