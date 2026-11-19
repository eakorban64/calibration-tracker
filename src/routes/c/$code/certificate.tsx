import { createFileRoute, notFound } from "@tanstack/react-router";
import { Certificate } from "@/client/features/Certificate";
import { formatCert } from "@/lib/calibration";
import { getPublicCertificate } from "@/serverFunctions/records";

// Public (everyapp.config.ts): the certificate behind a label's QR code.
export const Route = createFileRoute("/c/$code/certificate")({
  loader: async ({ params }) => {
    if (!/^[a-z0-9]{6,32}$/.test(params.code)) throw notFound();
    const data = await getPublicCertificate({ data: { code: params.code } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Certificate ${formatCert(loaderData.record.certNumber)}` : "Certificate" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicCertificate,
});

function PublicCertificate() {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6">
      <Certificate data={Route.useLoaderData()} />
    </main>
  );
}
