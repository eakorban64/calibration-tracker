import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { QrCode } from "@/client/features/QrCode";
import { EmptyState } from "@/client/components/EmptyState";
import { addDays, formatCert } from "@/lib/calibration";
import { getRecordDetail } from "@/serverFunctions/records";

export const Route = createFileRoute("/records/$id/label")({
  loader: async ({ params }) => {
    const data = await getRecordDetail({ data: { id: params.id } });
    if (!data.found) throw notFound();
    return { ...data.found, publicUrl: data.publicUrl! };
  },
  head: () => ({ meta: [{ title: "Label · Calibration Tracker" }] }),
  component: LabelPage,
});

function LabelPage() {
  const { record, item, publicUrl } = Route.useLoaderData();
  const back = (
    <Link to="/records/$id" params={{ id: record.id }} className="text-sm text-muted-foreground hover:text-foreground">
      ‹ {formatCert(record.certNumber)}
    </Link>
  );
  if (record.result !== "pass") {
    return (
      <AppShell>
        <PageHeader backLink={back} title="Label" />
        <EmptyState kind="error" title="No label for a failed calibration" />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="print:hidden">
        <PageHeader
          backLink={back}
          title="Label"
          actions={
            <Button onClick={() => window.print()}>
              <Printer aria-hidden />
              Print
            </Button>
          }
        />
      </div>
      <div
        data-testid="label"
        className="flex w-fit max-w-full items-center gap-4 rounded-lg border-2 border-foreground bg-background p-4 text-foreground"
      >
        <div data-testid="label-qr">
          <QrCode value={publicUrl} size={112} />
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-semibold">{item.code}</dd>
          <dt className="text-muted-foreground">Calibrated</dt>
          <dd className="tabular-nums">{record.calDate}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd className="font-semibold tabular-nums">{addDays(record.calDate, item.intervalDays)}</dd>
          <dt className="text-muted-foreground">By</dt>
          <dd>{record.technician}</dd>
          <dt className="text-muted-foreground">Cert.</dt>
          <dd className="tabular-nums">{formatCert(record.certNumber)}</dd>
        </dl>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">
        The code opens <span data-testid="label-url" className="break-all text-foreground">{publicUrl}</span>
      </p>
    </AppShell>
  );
}
