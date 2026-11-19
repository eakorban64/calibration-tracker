import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { newDraft, RecordForm } from "@/client/features/RecordForm";
import { today } from "@/lib/calibration";
import { getEquipmentDetail } from "@/serverFunctions/equipment";

export const Route = createFileRoute("/equipment/$id/calibrate")({
  loader: async ({ params }) => {
    const data = await getEquipmentDetail({ data: { id: params.id } });
    if (!data.detail) throw notFound();
    return { item: data.detail.item };
  },
  head: () => ({ meta: [{ title: "Record calibration · Calibration Tracker" }] }),
  component: Calibrate,
});

function Calibrate() {
  const { item } = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader
        backLink={
          <Link to="/equipment/$id" params={{ id: item.id }} className="text-sm text-muted-foreground hover:text-foreground">
            ‹ {item.code}
          </Link>
        }
        title="Record calibration"
        description={`${item.code} · ${item.name}${item.range ? ` · ${item.range}` : ""}`}
      />
      <RecordForm equipmentId={item.id} initial={newDraft(today(), item.referenceStandard)} />
    </AppShell>
  );
}
