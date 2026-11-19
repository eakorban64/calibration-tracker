import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { Paperclip, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ButtonLink } from "@/client/components/ButtonLink";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ResultBadge, StateBadge } from "@/client/components/StatusBadges";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { EquipmentDialog } from "@/client/features/EquipmentDialog";
import { MovementsTable } from "@/client/features/MovementsTable";
import { calState, CONDITION_LABEL, formatCert, STATUS_LABEL } from "@/lib/calibration";
import { getEquipmentDetail } from "@/serverFunctions/equipment";

export const Route = createFileRoute("/equipment/$id/")({
  loader: async ({ params }) => {
    const data = await getEquipmentDetail({ data: { id: params.id } });
    if (!data.detail) throw notFound();
    return { actor: data.actor, ...data.detail };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.item.code} · Calibration Tracker` : "Calibration Tracker" }],
  }),
  component: EquipmentDetail,
});

function EquipmentDetail() {
  const { item, records, movements, files, duplicates, actor } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const state = calState(item);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("equipmentId", item.id);
      form.set("file", file);
      const res = await fetch("/files/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Upload failed.");
      }
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const facts: [string, string, string?][] = [
    ["Serial number", item.serial],
    ["Manufacturer", item.manufacturer],
    ["Model", item.model],
    ["Category", item.category],
    ["Location", item.location],
    ["Owner", [item.owner, item.ownerEmail].filter(Boolean).join(" · ")],
    ["Range", item.range],
    ["Condition", CONDITION_LABEL[item.condition] ?? item.condition],
    ["Status", STATUS_LABEL[item.status] ?? item.status],
    ["Interval", `${item.intervalDays} days`],
    ["Reference standard", item.referenceStandard],
    ["Last calibrated", item.lastCalDate ?? "Never", "equipment-last-cal"],
    ["Next due", item.nextDueDate ?? "Not set", "equipment-next-due"],
    ["In the crib", item.holder ? `Out with ${item.holder}, back ${item.expectedReturn}` : "Yes"],
  ];

  return (
    <AppShell>
      <PageHeader
        backLink={
          <Link to="/equipment" className="text-sm text-muted-foreground hover:text-foreground">
            ‹ Equipment
          </Link>
        }
        title={item.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span data-testid="equipment-code" className="font-medium text-foreground">{item.code}</span>
            {item.status === "out_of_service" ? (
              <span>Out of service</span>
            ) : (
              <StateBadge state={state} testId="equipment-state" />
            )}
          </span>
        }
        actions={
          actor.canEdit ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <ButtonLink
                data-testid="record-calibration" to="/equipment/$id/calibrate" params={{ id: item.id }}>
                Record calibration
              </ButtonLink>
            </>
          ) : null
        }
      />
      {duplicates.length ? (
        <Alert data-testid="duplicate-serial-warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>
            Serial number {item.serial} is also on {duplicates.join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([label, value, testId]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd data-testid={testId}>{value || "—"}</dd>
              </div>
            ))}
            {item.toleranceNotes ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-muted-foreground">Tolerance notes</dt>
                <dd className="whitespace-pre-wrap">{item.toleranceNotes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Calibration records</TabsTrigger>
          <TabsTrigger value="crib">Crib history</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="pt-3">
          <div data-testid="records-list">
            {records.length === 0 ? (
              <EmptyState title="No calibrations recorded" size="sm" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link to="/records/$id" params={{ id: r.id }} className="text-primary hover:underline">
                            {formatCert(r.certNumber)}
                          </Link>
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
          </div>
        </TabsContent>
        <TabsContent value="crib" className="pt-3">
          <div data-testid="equipment-crib-history">
            <MovementsTable rows={movements} />
          </div>
        </TabsContent>
      </Tabs>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Files</h2>
          {actor.canEdit ? (
            <>
              <input
                ref={fileInput}
                type="file"
                hidden
                data-testid="attachment-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <Paperclip aria-hidden />
                {uploading ? "Uploading…" : "Upload file"}
              </Button>
            </>
          ) : null}
        </div>
        {files.length === 0 ? (
          <EmptyState title="No files" description="Up to 20 MB each." size="sm" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <a href={`/files/${f.id}`} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                  {f.fileName}
                </a>
                <span className="shrink-0 text-muted-foreground">
                  {f.recordId ? "Report · " : ""}
                  {formatSize(f.size)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <EquipmentDialog
          calibrated={records.length > 0}
          onClose={() => setEditing(false)}
          initial={{
            id: item.id,
            name: item.name,
            code: item.code,
            serial: item.serial,
            manufacturer: item.manufacturer,
            model: item.model,
            category: item.category,
            location: item.location,
            owner: item.owner,
            ownerEmail: item.ownerEmail,
            range: item.range,
            condition: item.condition as "good",
            intervalDays: item.intervalDays,
            toleranceNotes: item.toleranceNotes,
            referenceStandard: item.referenceStandard,
            status: item.status as "active",
            nextDueDate: item.nextDueDate ?? "",
          }}
        />
      ) : null}
    </AppShell>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
