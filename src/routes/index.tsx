import { createFileRoute, Link } from "@tanstack/react-router";
import { ButtonLink } from "@/client/components/ButtonLink";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Card, CardContent } from "@/client/components/ui/card";
import { ActivityList } from "@/routes/activity";
import { getDashboard } from "@/serverFunctions/workspace";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  head: () => ({ meta: [{ title: "Dashboard · Calibration Tracker" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { counts, recent, actor } = Route.useLoaderData();
  const cards = [
    { id: "overdue", label: "Overdue", value: counts.overdue, search: { state: "overdue" } },
    { id: "due-60", label: "Due in 60 days", value: counts.due60, search: { due: 60 } },
    { id: "current", label: "Current", value: counts.current, search: { state: "current" } },
    { id: "out-of-service", label: "Out of service", value: counts.outOfService, search: { status: "out_of_service" } },
  ] as const;
  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        actions={
          actor.canEdit ? (
            <ButtonLink to="/equipment" search={{ add: true }}>
              Add equipment
            </ButtonLink>
          ) : null
        }
      />
      {counts.total === 0 ? (
        <EmptyState
          title="No equipment yet"
          description="Add your gages and instruments to start tracking their calibrations."
          action={
            actor.canEdit ? (
              <ButtonLink to="/equipment" search={{ add: true }}>
                Add equipment
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.id}
              to="/equipment"
              search={card.search}
              data-testid={`card-${card.id}`}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="space-y-1">
                  <div className="text-sm text-muted-foreground">{card.label}</div>
                  <div
                    className="text-3xl font-semibold tabular-nums"
                    data-testid={`count-${card.id}`}
                  >
                    {card.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Link to="/activity" className="text-sm text-muted-foreground hover:text-foreground">
            All activity
          </Link>
        </div>
        <div data-testid="recent-activity">
          <ActivityList rows={recent} />
        </div>
      </section>
    </AppShell>
  );
}
