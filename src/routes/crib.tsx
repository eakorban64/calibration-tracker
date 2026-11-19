import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { PageHeader } from "@/client/components/PageHeader";
import { StateBadge } from "@/client/components/StatusBadges";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Toggle } from "@/client/components/ui/toggle";
import { MovementsTable } from "@/client/features/MovementsTable";
import { toastError } from "@/client/lib/errors";
import { addDays, calState, checkoutBlock, CONDITION_LABEL, today } from "@/lib/calibration";
import { checkin, checkout, getCrib } from "@/serverFunctions/crib";

export const Route = createFileRoute("/crib")({
  loader: () => getCrib(),
  head: () => ({ meta: [{ title: "Crib · Calibration Tracker" }] }),
  component: CribPage,
});

type View = "all" | "in" | "out";

function CribPage() {
  const { items, history, actor } = Route.useLoaderData();
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [needsCal, setNeedsCal] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "out" | "in"; id: string; code: string } | null>(null);
  const on = today();

  const rows = useMemo(
    () =>
      items
        .map((i) => ({ ...i, state: calState(i, on), block: checkoutBlock(i, on) }))
        .filter((i) => (view === "in" ? !i.holder : view === "out" ? !!i.holder : true))
        .filter((i) => !needsCal || ["due_soon", "overdue", "failed"].includes(i.state)),
    [items, view, needsCal, on],
  );
  const outCount = items.filter((i) => i.holder).length;

  return (
    <AppShell>
      <PageHeader
        title="Tool crib"
        description={`${items.length - outCount} on hand · ${outCount} checked out`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["in", "On hand"],
            ["out", "Checked out"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={view === value ? "secondary" : "ghost"}
            aria-pressed={view === value}
            data-testid={`crib-view-${value}`}
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
        <Toggle size="sm" variant="outline" pressed={needsCal} onPressedChange={setNeedsCal} data-testid="crib-needs-cal">
          Needs calibration
        </Toggle>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No equipment yet" description="Items in the register show up here." />
      ) : rows.length === 0 ? (
        <EmptyState kind="filtered" title="Nothing matches" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Calibration</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id} data-testid={`crib-row-${i.code}`}>
                  <TableCell>
                    <Link to="/equipment/$id" params={{ id: i.id }} className="font-medium text-primary hover:underline">
                      {i.code}
                    </Link>{" "}
                    <span className="text-muted-foreground">{i.name}</span>
                  </TableCell>
                  <TableCell>
                    {i.holder ? (
                      <>
                        Out with {i.holder}
                        <div className="text-xs text-muted-foreground">back {i.expectedReturn}</div>
                      </>
                    ) : (
                      "On hand"
                    )}
                  </TableCell>
                  <TableCell>{i.holder ? i.holderLocation || "—" : i.location || "—"}</TableCell>
                  <TableCell>{CONDITION_LABEL[i.condition]}</TableCell>
                  <TableCell>
                    {i.status === "out_of_service" ? <span className="text-muted-foreground">Out of service</span> : <StateBadge state={i.state} />}
                  </TableCell>
                  <TableCell className="text-right">
                    {!actor.canEdit ? null : i.holder ? (
                      <Button size="sm" variant="outline" data-testid={`checkin-${i.code}`} onClick={() => setDialog({ kind: "in", id: i.id, code: i.code })}>
                        Check in
                      </Button>
                    ) : i.block ? (
                      <span className="text-sm text-muted-foreground" data-testid={`checkout-blocked-${i.code}`}>
                        {i.block}
                      </span>
                    ) : (
                      <Button size="sm" data-testid={`checkout-${i.code}`} onClick={() => setDialog({ kind: "out", id: i.id, code: i.code })}>
                        Check out
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">History</h2>
        <div data-testid="crib-history">
          <MovementsTable rows={history} />
        </div>
      </section>
      {dialog?.kind === "out" ? (
        <CheckoutDialog
          code={dialog.code}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await checkout({ data: { equipmentId: dialog.id, ...v } });
            toast.success(`${dialog.code} checked out`);
            await router.invalidate();
          }}
        />
      ) : null}
      {dialog?.kind === "in" ? (
        <CheckinDialog
          code={dialog.code}
          onClose={() => setDialog(null)}
          onSubmit={async (condition) => {
            await checkin({ data: { equipmentId: dialog.id, condition } });
            toast.success(`${dialog.code} checked in`);
            await router.invalidate();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function useSubmit(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (work: () => Promise<void>) => {
      setBusy(true);
      try {
        await work();
        onClose();
      } catch (error) {
        toastError(error);
      } finally {
        setBusy(false);
      }
    },
  };
}

function CheckoutDialog({
  code,
  onClose,
  onSubmit,
}: {
  code: string;
  onClose: () => void;
  onSubmit: (v: { person: string; location: string; expectedReturn: string }) => Promise<void>;
}) {
  const [person, setPerson] = useState("");
  const [location, setLocation] = useState("");
  const [expectedReturn, setExpectedReturn] = useState(addDays(today(), 7));
  const { busy, run } = useSubmit(onClose);
  return (
    <FormDialog
      title={`Check out ${code}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="crib-confirm" disabled={busy || !person.trim()} onClick={() => run(() => onSubmit({ person, location, expectedReturn }))}>
            Check out
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormRow label="To" htmlFor="crib-person">
          <Input id="crib-person" data-testid="crib-person" value={person} onChange={(e) => setPerson(e.target.value)} />
        </FormRow>
        <FormRow label="Used at" htmlFor="crib-location">
          <Input id="crib-location" data-testid="crib-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </FormRow>
        <FormRow label="Expected back" htmlFor="crib-return">
          <Input id="crib-return" data-testid="crib-return" type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
        </FormRow>
      </div>
    </FormDialog>
  );
}

function CheckinDialog({
  code,
  onClose,
  onSubmit,
}: {
  code: string;
  onClose: () => void;
  onSubmit: (condition: "good" | "fair" | "damaged") => Promise<void>;
}) {
  const [condition, setCondition] = useState<"good" | "fair" | "damaged">("good");
  const { busy, run } = useSubmit(onClose);
  return (
    <FormDialog
      title={`Check in ${code}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="crib-confirm" disabled={busy} onClick={() => run(() => onSubmit(condition))}>
            Check in
          </Button>
        </>
      }
    >
      <FormRow label="Condition on return" htmlFor="crib-condition">
        <ChoiceSelect
          id="crib-condition"
          testId="crib-condition"
          value={condition}
          onChange={setCondition}
          choices={[
            { value: "good", label: "Good" },
            { value: "fair", label: "Fair" },
            { value: "damaged", label: "Damaged" },
          ]}
        />
      </FormRow>
    </FormDialog>
  );
}
