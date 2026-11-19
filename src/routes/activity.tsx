import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { getActivity } from "@/serverFunctions/workspace";

export const Route = createFileRoute("/activity")({
  loader: () => getActivity(),
  head: () => ({ meta: [{ title: "Activity · Calibration Tracker" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const rows = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader title="Activity" />
      <div data-testid="activity-list">
        <ActivityList rows={rows} />
      </div>
    </AppShell>
  );
}

interface ActivityRow {
  id: string;
  userEmail: string;
  action: string;
  subject: string;
  link: string | null;
  createdAt: string;
}

export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing has happened yet" size="sm" />;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <div className="min-w-0">
            <span className="font-medium">{row.action}</span>{" "}
            {row.link ? (
              <Link to={row.link} className="text-primary hover:underline">
                {row.subject}
              </Link>
            ) : (
              <span>{row.subject}</span>
            )}
          </div>
          <div className="text-muted-foreground">
            {row.userEmail} · <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function formatWhen(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}
