import { createFileRoute, notFound } from "@tanstack/react-router";
import { ResultBadge } from "@/client/components/StatusBadges";
import { ButtonAnchor } from "@/client/components/ButtonLink";
import { Card, CardContent } from "@/client/components/ui/card";
import { formatCert } from "@/lib/calibration";
import { getPublicCertificate } from "@/serverFunctions/records";

// Public (everyapp.config.ts): what a label's QR code opens, for anyone.
export const Route = createFileRoute("/c/$code/")({
  loader: async ({ params }) => {
    if (!/^[a-z0-9]{6,32}$/.test(params.code)) throw notFound();
    const data = await getPublicCertificate({ data: { code: params.code } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Calibration record" }, { name: "robots", content: "noindex" }] }),
  component: PublicRecord,
});

function PublicRecord() {
  const { record, item, company } = Route.useLoaderData();
  const { code } = Route.useParams();
  const facts: [string, string][] = [
    ["Equipment ID", item.code],
    ["Serial number", item.serial || "—"],
    ["Calibrated", record.calDate],
    ["Next due", record.nextDue],
    ["Certificate", formatCert(record.certNumber)],
  ];
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      {company.companyName ? <p className="text-sm text-muted-foreground">{company.companyName}</p> : null}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="public-equipment">
          {item.name}
        </h1>
        <ResultBadge result={record.result} testId="public-result" />
      </div>
      <Card>
        <CardContent>
          <dl className="divide-y divide-border text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <ButtonAnchor href={`/c/${code}/certificate`} data-testid="public-certificate-link" className="w-full">
        View certificate
      </ButtonAnchor>
    </main>
  );
}
