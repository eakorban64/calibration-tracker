import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { ButtonAnchor } from "@/client/components/ButtonLink";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ResultBadge } from "@/client/components/StatusBadges";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatCert } from "@/lib/calibration";
import { getRecordList } from "@/serverFunctions/records";

interface Search {
  equipmentId?: string;
  result?: "pass" | "fail";
  from?: string;
  to?: string;
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const Route = createFileRoute("/records/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    equipmentId: typeof s.equipmentId === "string" && /^[0-9a-f-]{36}$/.test(s.equipmentId) ? s.equipmentId : undefined,
    result: s.result === "pass" || s.result === "fail" ? s.result : undefined,
    from: isDate(s.from) ? s.from : undefined,
    to: isDate(s.to) ? s.to : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getRecordList({ data: deps }),
  head: () => ({ meta: [{ title: "Records · Calibration Tracker" }] }),
  component: RecordsPage,
});

function RecordsPage() {
  const { rows, items } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/records/" });
  const setSearch = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const exportHref = `/export/records.csv?${new URLSearchParams(
    Object.entries(search).filter((e): e is [string, string] => typeof e[1] === "string"),
  )}`;
  const filtered = Object.values(search).some(Boolean);

  return (
    <AppShell>
      <PageHeader
        title="Calibration records"
        actions={
          <ButtonAnchor variant="outline" href={exportHref} download>
            <Download aria-hidden />
            Export CSV
          </ButtonAnchor>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-equipment">Equipment</Label>
          <ChoiceSelect
            id="filter-equipment"
            testId="filter-equipment"
            className="w-56"
            value={search.equipmentId ?? "all"}
            onChange={(v) => setSearch({ equipmentId: v === "all" ? undefined : v })}
            choices={[{ value: "all", label: "All equipment" }, ...items.map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` }))]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-result">Result</Label>
          <ChoiceSelect
            id="filter-result"
            testId="filter-result"
            className="w-36"
            value={search.result ?? "all"}
            onChange={(v) => setSearch({ result: v === "all" ? undefined : v })}
            choices={[
              { value: "all", label: "All results" },
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">From</Label>
          <Input id="filter-from" data-testid="filter-from" type="date" className="w-40" value={search.from ?? ""} onChange={(e) => setSearch({ from: e.target.value || undefined })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-to">To</Label>
          <Input id="filter-to" data-testid="filter-to" type="date" className="w-40" value={search.to ?? ""} onChange={(e) => setSearch({ to: e.target.value || undefined })} />
        </div>
        {filtered ? (
          <Button variant="ghost" onClick={() => navigate({ search: {}, replace: true })}>
            Clear
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No records match these filters" />
        ) : (
          <EmptyState media="rows" title="No calibrations recorded yet" description="Record one from an item's page and it will appear here." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid="record-row">
                  <TableCell>
                    <Link to="/records/$id" params={{ id: r.id }} className="text-primary hover:underline">
                      {formatCert(r.certNumber)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{r.equipmentCode}</span> <span className="text-muted-foreground">{r.equipmentName}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.calDate}</TableCell>
                  <TableCell>{r.technician}</TableCell>
                  <TableCell><ResultBadge result={r.result} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
