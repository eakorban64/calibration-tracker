import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { CONDITION_LABEL } from "@/lib/calibration";

interface Movement {
  id: string;
  kind: string;
  person: string;
  location: string;
  expectedReturn: string | null;
  condition: string | null;
  byEmail: string;
  createdAt: string;
  equipmentId?: string;
  code?: string;
}

/** Check-outs and check-ins, newest first. */
export function MovementsTable({ rows }: { rows: Movement[] }) {
  if (rows.length === 0) return <EmptyState title="No check-outs yet" size="sm" />;
  const showItem = rows.some((r) => r.code);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            {showItem ? <TableHead>Equipment</TableHead> : null}
            <TableHead>Movement</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="tabular-nums">{m.createdAt.slice(0, 16).replace("T", " ")}</TableCell>
              {showItem ? (
                <TableCell>
                  {m.equipmentId ? (
                    <Link to="/equipment/$id" params={{ id: m.equipmentId }} className="text-primary hover:underline">
                      {m.code}
                    </Link>
                  ) : null}
                </TableCell>
              ) : null}
              <TableCell>{m.kind === "out" ? "Checked out" : "Checked in"}</TableCell>
              <TableCell>{m.person}</TableCell>
              <TableCell className="text-muted-foreground">
                {m.kind === "out"
                  ? [m.location, m.expectedReturn ? `back ${m.expectedReturn}` : ""].filter(Boolean).join(" · ")
                  : `Returned ${CONDITION_LABEL[m.condition ?? ""]?.toLowerCase() ?? ""}`}
              </TableCell>
              <TableCell className="text-muted-foreground">{m.byEmail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
