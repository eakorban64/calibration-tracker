import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { RecordForm } from "@/client/features/RecordForm";
import { formatCert } from "@/lib/calibration";
import { getRecordDetail } from "@/serverFunctions/records";

export const Route = createFileRoute("/records/$id/edit")({
  loader: async ({ params }) => {
    const data = await getRecordDetail({ data: { id: params.id } });
    if (!data.found) throw notFound();
    return data.found;
  },
  head: () => ({ meta: [{ title: "Edit calibration · Calibration Tracker" }] }),
  component: EditRecord,
});

function EditRecord() {
  const { record, item, points } = Route.useLoaderData();
  const str = (n: number | null) => (n === null ? "" : String(n));
  return (
    <AppShell>
      <PageHeader
        backLink={
          <Link to="/records/$id" params={{ id: record.id }} className="text-sm text-muted-foreground hover:text-foreground">
            ‹ {formatCert(record.certNumber)}
          </Link>
        }
        title="Edit calibration"
        description={`${item.code} · ${item.name}`}
      />
      <RecordForm
        equipmentId={item.id}
        initial={{
          id: record.id,
          calDate: record.calDate,
          technician: record.technician,
          procedure: record.procedure,
          temperature: str(record.temperature),
          temperatureUnit: record.temperatureUnit === "F" ? "F" : "C",
          humidity: str(record.humidity),
          points: points.length
            ? points.map((p) => ({ nominal: str(p.nominal), measured: str(p.measured), lower: str(p.lower), upper: str(p.upper) }))
            : [{ nominal: "", measured: "", lower: "", upper: "" }],
          result: record.result === "fail" ? "fail" : "pass",
          adjusted: record.adjusted,
          notes: record.notes,
        }}
      />
    </AppShell>
  );
}
