import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StateBadge } from "@/client/components/StatusBadges";
import { SortableHeader } from "@/client/components/table/SortableHeader";
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
import { BLANK_EQUIPMENT, EquipmentDialog } from "@/client/features/EquipmentDialog";
import {
  calState,
  CONDITION_LABEL,
  daysBetween,
  STATE_LABEL,
  today,
  type CalState,
} from "@/lib/calibration";
import { getEquipmentList } from "@/serverFunctions/equipment";

interface Search {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  state?: string;
  due?: number;
  add?: boolean;
}

export const Route = createFileRoute("/equipment/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    location: typeof s.location === "string" ? s.location : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    due: typeof s.due === "number" ? s.due : undefined,
    add: s.add === true ? true : undefined,
  }),
  loader: () => getEquipmentList(),
  head: () => ({ meta: [{ title: "Equipment · Calibration Tracker" }] }),
  component: EquipmentPage,
});

type SortKey = "code" | "name" | "category" | "location" | "nextDueDate";

function EquipmentPage() {
  const { items, actor } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/equipment/" });
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "nextDueDate", desc: false });
  const on = today();

  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const categories = useMemo(() => distinct(items.map((i) => i.category)), [items]);
  const locations = useMemo(() => distinct(items.map((i) => i.location)), [items]);

  const rows = useMemo(() => {
    const q = search.q?.toLowerCase() ?? "";
    const filtered = items
      .map((item) => ({ ...item, state: calState(item, on) }))
      .filter((i) => {
        if (q && ![i.code, i.name, i.serial, i.manufacturer, i.model, i.owner].some((f) => f.toLowerCase().includes(q))) return false;
        if (search.status && i.status !== search.status) return false;
        if (search.category && i.category !== search.category) return false;
        if (search.location && i.location !== search.location) return false;
        if (search.state && (i.state !== search.state || i.status !== "active")) return false;
        if (search.due !== undefined) {
          if (i.status !== "active" || !i.nextDueDate || i.state === "failed") return false;
          const left = daysBetween(on, i.nextDueDate);
          if (left < 0 || left > search.due) return false;
        }
        return true;
      });
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => {
      const x = a[sort.key] ?? "￿";
      const y = b[sort.key] ?? "￿";
      return x.localeCompare(y, undefined, { numeric: true }) * dir;
    });
  }, [items, search, sort, on]);

  const column = (key: SortKey) => ({
    getIsSorted: () => (sort.key === key ? (sort.desc ? "desc" : "asc") : false) as false | "asc" | "desc",
    getToggleSortingHandler: () => () =>
      setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: false })),
  });

  const filtersOn = !!(search.q || search.status || search.category || search.location || search.state || search.due !== undefined);

  return (
    <AppShell>
      <PageHeader
        title="Equipment"
        description={search.due !== undefined ? `Due in the next ${search.due} days` : undefined}
        actions={
          actor.canEdit ? (
            <Button data-testid="add-equipment" onClick={() => setSearch({ add: true })}>
              Add equipment
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid="equipment-search"
          aria-label="Search equipment"
          placeholder="Search"
          className="w-full sm:w-56"
          value={search.q ?? ""}
          onChange={(e) => setSearch({ q: e.target.value || undefined })}
        />
        <ChoiceSelect
          testId="filter-status"
          label="Status"
          className="w-40"
          value={search.status ?? "all"}
          onChange={(v) => setSearch({ status: v === "all" ? undefined : v })}
          choices={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "out_of_service", label: "Out of service" },
          ]}
        />
        <ChoiceSelect
          testId="filter-state"
          label="Calibration"
          className="w-40"
          value={search.state ?? "all"}
          onChange={(v) => setSearch({ state: v === "all" ? undefined : v })}
          choices={[
            { value: "all", label: "Any calibration" },
            ...(["current", "due_soon", "overdue", "failed"] as CalState[]).map((s) => ({ value: s, label: STATE_LABEL[s] })),
          ]}
        />
        <ChoiceSelect
          testId="filter-category"
          label="Category"
          className="w-44"
          value={search.category ?? "__all__"}
          onChange={(v) => setSearch({ category: v === "__all__" ? undefined : v })}
          choices={[{ value: "__all__", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
        <ChoiceSelect
          testId="filter-location"
          label="Location"
          className="w-44"
          value={search.location ?? "__all__"}
          onChange={(v) => setSearch({ location: v === "__all__" ? undefined : v })}
          choices={[{ value: "__all__", label: "All locations" }, ...locations.map((c) => ({ value: c, label: c }))]}
        />
        {filtersOn ? (
          <Button variant="ghost" onClick={() => navigate({ search: {}, replace: true })}>
            Clear
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          media="rows"
          title="No equipment yet"
          description={actor.canEdit ? "Add a gage or instrument and it will appear here." : undefined}
        />
      ) : rows.length === 0 ? (
        <EmptyState kind="filtered" title="Nothing matches these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader column={column("code")} label="Equipment ID" /></TableHead>
                <TableHead><SortableHeader column={column("name")} label="Name" /></TableHead>
                <TableHead><SortableHeader column={column("category")} label="Category" /></TableHead>
                <TableHead><SortableHeader column={column("location")} label="Location" /></TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Calibration</TableHead>
                <TableHead><SortableHeader column={column("nextDueDate")} label="Next due" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} data-testid="equipment-row">
                  <TableCell className="font-medium">
                    <Link to="/equipment/$id" params={{ id: item.id }} className="text-primary hover:underline">
                      {item.code}
                    </Link>
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell>{CONDITION_LABEL[item.condition]}</TableCell>
                  <TableCell>
                    {item.status === "out_of_service" ? (
                      <span className="text-muted-foreground">Out of service</span>
                    ) : (
                      <StateBadge state={item.state} />
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{item.nextDueDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {search.add && actor.canEdit ? (
        <EquipmentDialog
          initial={BLANK_EQUIPMENT}
          calibrated={false}
          onClose={() => setSearch({ add: undefined })}
        />
      ) : null}
    </AppShell>
  );
}

function distinct(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
