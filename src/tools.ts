// The app's tools for AI clients, served by the Gateway at /mcp. Read-only:
// changes go through the pages, where roles are enforced.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { calState } from "@/lib/calibration";
import { listEquipment } from "@/server/equipment";
import { overdue, upcoming } from "@/server/reports";

export const tools = defineTools({
  list_equipment: {
    description: "List the equipment register with each item's calibration state and next due date.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async () =>
      (await listEquipment()).map((i) => ({
        equipmentId: i.code,
        name: i.name,
        category: i.category,
        location: i.location,
        status: i.status,
        calibrationState: calState(i),
        nextDue: i.nextDueDate,
        holder: i.holder,
      })),
  },
  calibrations_due: {
    description: "Overdue equipment, and equipment due within the given number of days.",
    risk: "read",
    input: z.object({ days: z.number().int().min(1).max(730).default(30) }).strict(),
    handler: async ({ days }) => ({
      overdue: (await overdue()).map((i) => ({ equipmentId: i.code, name: i.name, nextDue: i.nextDueDate, daysLate: i.daysLate })),
      upcoming: (await upcoming(days)).map((i) => ({ equipmentId: i.code, name: i.name, nextDue: i.nextDueDate, daysLeft: i.daysLeft })),
    }),
  },
});
