import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Certificate } from "@/client/features/Certificate";
import { formatCert } from "@/lib/calibration";
import { getRecordCertificate } from "@/serverFunctions/records";

export const Route = createFileRoute("/records/$id/certificate")({
  loader: async ({ params }) => {
    const data = await getRecordCertificate({ data: { id: params.id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Certificate ${formatCert(loaderData.record.certNumber)}` : "Certificate" }],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const data = Route.useLoaderData();
  const { id } = Route.useParams();
  return (
    <AppShell>
      <div className="print:hidden">
        <PageHeader
          backLink={
            <Link to="/records/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
              ‹ {formatCert(data.record.certNumber)}
            </Link>
          }
          title="Certificate"
          actions={
            <Button data-testid="print" onClick={() => window.print()}>
              <Printer aria-hidden />
              Print or save as PDF
            </Button>
          }
        />
      </div>
      <Certificate data={data} />
    </AppShell>
  );
}
