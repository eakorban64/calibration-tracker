import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ButtonLink } from "@/client/components/ButtonLink";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { ResultBadge } from "@/client/components/StatusBadges";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatWhen } from "@/routes/activity";
import { formatCert } from "@/lib/calibration";
import { getRecordDetail } from "@/serverFunctions/records";

export const Route = createFileRoute("/records/$id/")({
  loader: async ({ params }) => {
    const data = await getRecordDetail({ data: { id: params.id } });
    if (!data.found) throw notFound();
    return { actor: data.actor, ...data.found };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${formatCert(loaderData.record.certNumber)} · Calibration Tracker` : "Calibration Tracker" }],
  }),
  component: RecordPage,
});

function RecordPage() {
  const { record, item, points, files, actor } = Route.useLoaderData();
  const environment = [
    record.temperature !== null ? `${record.temperature} °${record.temperatureUnit}` : null,
    record.humidity !== null ? `${record.humidity}% RH` : null,
  ].filter(Boolean);
  return (
    <AppShell>
      <PageHeader
        backLink={
          <Link to="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ‹ Records
          </Link>
        }
        title={<span data-testid="cert-number">{formatCert(record.certNumber)}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              data-testid="record-equipment-link"
              to="/equipment/$id"
              params={{ id: item.id }}
              className="text-primary hover:underline"
            >
              {item.code} · {item.name}
            </Link>
            <ResultBadge result={record.result} testId="record-result" />
          </span>
        }
        actions={
          <>
            {actor.canEdit ? (
              <ButtonLink variant="outline" data-testid="edit-record" to="/records/$id/edit" params={{ id: record.id }}>
                Edit
              </ButtonLink>
            ) : null}
            <ButtonLink variant="outline" data-testid="open-certificate" to="/records/$id/certificate" params={{ id: record.id }}>
              Certificate
            </ButtonLink>
            {record.result === "pass" ? (
              <ButtonLink data-testid="print-label" to="/records/$id/label" params={{ id: record.id }}>
                Label
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Calibration date" value={record.calDate} />
            <Fact label="Technician" value={record.technician} />
            <Fact label="Procedure" value={record.procedure} />
            <Fact label="Environment" value={environment.join(", ")} testId="record-environment" />
            <Fact label="Adjusted" value={record.adjusted ? "Yes" : "No"} />
            <Fact label="Recorded by" value={`${record.createdBy}, ${formatWhen(record.createdAt)}`} />
            {record.updatedAt ? (
              <Fact label="Last edited" value={`${record.updatedBy}, ${formatWhen(record.updatedAt)}`} testId="record-edited" />
            ) : null}
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-muted-foreground">Notes</dt>
              <dd data-testid="record-notes" className="whitespace-pre-wrap">{record.notes || "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Test points</h2>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Measured</TableHead>
                  <TableHead>Lower limit</TableHead>
                  <TableHead>Upper limit</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p.id} className="tabular-nums">
                    <TableCell>{p.nominal}</TableCell>
                    <TableCell>{p.measured}</TableCell>
                    <TableCell>{p.lower}</TableCell>
                    <TableCell>{p.upper}</TableCell>
                    <TableCell data-testid="point-result">{p.pass ? "Pass" : "Fail"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {files.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">External report</h2>
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id}>
                <a href={`/files/${f.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {f.fileName}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd data-testid={testId}>{value || "—"}</dd>
    </div>
  );
}
