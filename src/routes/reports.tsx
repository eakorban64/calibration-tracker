import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink, ButtonAnchor } from "@/client/components/ButtonLink";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getReports } from "@/serverFunctions/workspace";

const WINDOWS = [30, 60, 90, 180, 365] as const;

export const Route = createFileRoute("/reports")({
  validateSearch: (s: Record<string, unknown>): { days?: number } => ({
    days: WINDOWS.includes(s.days as 30) ? (s.days as number) : undefined,
  }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  loader: ({ deps }) => getReports({ data: deps }),
  head: () => ({ meta: [{ title: "Reports · Calibration Tracker" }] }),
  component: ReportsPage,
});

interface DueRow {
  id: string;
  code: string;
  name: string;
  location: string;
  owner: string;
  lastCalDate: string | null;
  nextDueDate: string | null;
}

function ReportsPage() {
  const { upcoming, overdue, actor } = Route.useLoaderData();
  const days = Route.useSearch().days ?? 30;
  const navigate = useNavigate({ from: "/reports" });
  return (
    <AppShell>
      <PageHeader title="Reports" />
      <Section
        title="Overdue"
        action={<ExportButton href="/export/overdue.csv" />}
      >
        {overdue.length === 0 ? (
          <EmptyState title="Nothing is overdue" size="sm" />
        ) : (
          <DueTable
            rows={overdue}
            testId="overdue-row"
            canRecord={actor.canEdit}
            lastHeader="Days late"
            last={(r) => (r as (typeof overdue)[number]).daysLate}
          />
        )}
      </Section>
      <Section
        title="Upcoming"
        action={
          <>
            <ChoiceSelect
              testId="report-window"
              label="Window"
              className="w-40"
              value={String(days)}
              onChange={(v) => navigate({ search: { days: Number(v) }, replace: true })}
              choices={WINDOWS.map((d) => ({ value: String(d), label: `Next ${d} days` }))}
            />
            <ExportButton href={`/export/upcoming.csv?days=${days}`} />
          </>
        }
      >
        <div data-testid="upcoming-list">
          {upcoming.length === 0 ? (
            <EmptyState title={`Nothing due in the next ${days} days`} size="sm" />
          ) : (
            <DueTable
              rows={upcoming}
              testId="upcoming-row"
              canRecord={actor.canEdit}
              lastHeader="Days left"
              last={(r) => (r as (typeof upcoming)[number]).daysLeft}
            />
          )}
        </div>
      </Section>
    </AppShell>
  );
}

function Section({ title, action, children }: { title: string; action: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {children}
    </section>
  );
}

function ExportButton({ href }: { href: string }) {
  return (
    <ButtonAnchor variant="outline" href={href} download>
      <Download aria-hidden />
      CSV
    </ButtonAnchor>
  );
}

function DueTable({
  rows,
  testId,
  canRecord,
  lastHeader,
  last,
}: {
  rows: DueRow[];
  testId: string;
  canRecord: boolean;
  lastHeader: string;
  last: (row: DueRow) => number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Next due</TableHead>
            <TableHead className="text-right">{lastHeader}</TableHead>
            {canRecord ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-testid={testId}>
              <TableCell>
                <Link to="/equipment/$id" params={{ id: r.id }} className="font-medium text-primary hover:underline">
                  {r.code}
                </Link>{" "}
                <span className="text-muted-foreground">{r.name}</span>
              </TableCell>
              <TableCell>{r.location || "—"}</TableCell>
              <TableCell>{r.owner || "—"}</TableCell>
              <TableCell className="tabular-nums">{r.nextDueDate}</TableCell>
              <TableCell className="text-right tabular-nums">{last(r)}</TableCell>
              {canRecord ? (
                <TableCell className="text-right">
                  <ButtonLink size="sm" variant="outline" to="/equipment/$id/calibrate" params={{ id: r.id }}>
                    Record calibration
                  </ButtonLink>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
