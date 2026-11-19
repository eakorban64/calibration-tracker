import { createFileRoute } from "@tanstack/react-router";
import { calState, formatCert, STATE_LABEL, toCsv } from "@/lib/calibration";
import { memberOf } from "@/server/files";
import { listRecords, recordFilters } from "@/server/records";
import { overdue, upcoming } from "@/server/reports";

function csv(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}

export const Route = createFileRoute("/export/$report")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { report: string } }) => {
        const actor = await memberOf(request);
        if (actor instanceof Response) return actor;
        const query = Object.fromEntries(
          [...new URL(request.url).searchParams].filter(([, v]) => v !== ""),
        );
        if (params.report === "records.csv") {
          const filters = recordFilters.safeParse(query);
          if (!filters.success) return new Response("Bad filters", { status: 400 });
          const rows = await listRecords(filters.data);
          return csv(
            "calibration-records.csv",
            toCsv(
              ["Certificate", "Equipment ID", "Equipment", "Date", "Technician", "Procedure", "Temperature", "Unit", "Humidity %", "Result", "Adjusted"],
              rows.map((r) => [
                formatCert(r.certNumber), r.equipmentCode, r.equipmentName, r.calDate, r.technician, r.procedure,
                r.temperature, r.temperature === null ? "" : `°${r.temperatureUnit}`, r.humidity, r.result, r.adjusted ? "yes" : "no",
              ]),
            ),
          );
        }
        if (params.report === "upcoming.csv") {
          const days = Math.min(730, Math.max(1, Number(query.days ?? 30) || 30));
          const rows = await upcoming(days);
          return csv(
            "calibrations-upcoming.csv",
            toCsv(
              ["Equipment ID", "Equipment", "Category", "Location", "Owner", "Last calibrated", "Next due", "Days left", "State"],
              rows.map((r) => [r.code, r.name, r.category, r.location, r.owner, r.lastCalDate, r.nextDueDate, r.daysLeft, STATE_LABEL[calState(r)]]),
            ),
          );
        }
        if (params.report === "overdue.csv") {
          const rows = await overdue();
          return csv(
            "calibrations-overdue.csv",
            toCsv(
              ["Equipment ID", "Equipment", "Category", "Location", "Owner", "Last calibrated", "Next due", "Days late"],
              rows.map((r) => [r.code, r.name, r.category, r.location, r.owner, r.lastCalDate, r.nextDueDate, r.daysLate]),
            ),
          );
        }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});
