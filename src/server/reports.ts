import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { equipment } from "@/db/schema";
import { addDays, calState, daysBetween, today } from "@/lib/calibration";
import { listActivity } from "@/server/activity";

const columns = {
  id: equipment.id,
  code: equipment.code,
  name: equipment.name,
  category: equipment.category,
  location: equipment.location,
  owner: equipment.owner,
  ownerEmail: equipment.ownerEmail,
  status: equipment.status,
  lastCalDate: equipment.lastCalDate,
  nextDueDate: equipment.nextDueDate,
  lastResult: equipment.lastResult,
};

async function activeItems() {
  return db.select(columns).from(equipment).where(eq(equipment.status, "active")).orderBy(asc(equipment.nextDueDate));
}

export async function dashboard() {
  const on = today();
  const [all, recent] = await Promise.all([
    db.select({ ...columns }).from(equipment).orderBy(desc(equipment.createdAt)),
    listActivity(12),
  ]);
  const counts = { overdue: 0, due60: 0, current: 0, outOfService: 0, total: all.length };
  for (const item of all) {
    if (item.status === "out_of_service") {
      counts.outOfService++;
      continue;
    }
    const state = calState(item, on);
    if (state === "overdue") counts.overdue++;
    else if (item.nextDueDate && daysBetween(on, item.nextDueDate) <= 60 && state !== "failed") counts.due60++;
    if (state === "current") counts.current++;
  }
  return { counts, recent };
}

/** Active items due from today through `days` ahead. */
export async function upcoming(days: number) {
  const on = today();
  const until = addDays(on, days);
  return (await activeItems())
    .filter((i) => i.nextDueDate && i.nextDueDate >= on && i.nextDueDate <= until)
    .map((i) => ({ ...i, daysLeft: daysBetween(on, i.nextDueDate!) }));
}

export async function overdue() {
  const on = today();
  return (await activeItems())
    .filter((i) => i.nextDueDate && i.nextDueDate < on)
    .map((i) => ({ ...i, daysLate: daysBetween(i.nextDueDate!, on) }));
}
