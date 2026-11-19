import { fillCompany, formatCert } from "@/lib/calibration";

export interface CertificateData {
  record: {
    certNumber: number;
    calDate: string;
    technician: string;
    procedure: string;
    temperature: number | null;
    temperatureUnit: string;
    humidity: number | null;
    result: string;
    adjusted: boolean;
    nextDue: string;
  };
  item: {
    code: string;
    name: string;
    serial: string;
    manufacturer: string;
    model: string;
    range: string;
    referenceStandard: string;
  };
  points: { nominal: number; measured: number; lower: number; upper: number; pass: boolean }[];
  company: { companyName: string; disclaimer: string };
}

/** The printable certificate: one sheet, readable on paper and on a phone. */
export function Certificate({ data }: { data: CertificateData }) {
  const { record, item, points, company } = data;
  const environment = [
    record.temperature !== null ? `${record.temperature} °${record.temperatureUnit}` : null,
    record.humidity !== null ? `${record.humidity}% RH` : null,
  ].filter(Boolean);
  const rows: [string, string][] = [
    ["Equipment", item.name],
    ["Equipment ID", item.code],
    ["Serial number", item.serial],
    ["Manufacturer / model", [item.manufacturer, item.model].filter(Boolean).join(" ")],
    ["Range", item.range],
    ["Calibration date", record.calDate],
    ["Next due", record.nextDue],
    ["Procedure", record.procedure || item.referenceStandard],
    ["Environment", environment.join(", ")],
    ["Adjusted", record.adjusted ? "Yes" : "No"],
    ["Technician", record.technician],
  ];
  return (
    <article
      data-testid="certificate"
      className="space-y-6 rounded-xl border border-border bg-card p-5 text-sm text-card-foreground sm:p-8 print:border-0 print:p-0"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-lg font-semibold">{company.companyName || "Calibration certificate"}</div>
          <div className="text-muted-foreground">Calibration certificate</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Certificate no.</div>
          <div className="text-lg font-semibold tabular-nums">{formatCert(record.certNumber)}</div>
        </div>
      </header>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {points.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Nominal</th>
                <th className="py-1.5 pr-3 font-medium">Measured</th>
                <th className="py-1.5 pr-3 font-medium">Lower limit</th>
                <th className="py-1.5 pr-3 font-medium">Upper limit</th>
                <th className="py-1.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} data-testid="certificate-point" className="border-b border-border/60">
                  <td className="py-1.5 pr-3">{p.nominal}</td>
                  <td className="py-1.5 pr-3">{p.measured}</td>
                  <td className="py-1.5 pr-3">{p.lower}</td>
                  <td className="py-1.5 pr-3">{p.upper}</td>
                  <td className="py-1.5">{p.pass ? "Pass" : "Fail"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex items-baseline gap-3 text-base">
        <span className="text-muted-foreground">Overall result</span>
        <span className="font-semibold">{record.result === "pass" ? "Pass" : "Fail"}</span>
      </div>
      {company.disclaimer ? (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {fillCompany(company.disclaimer, company.companyName)}
        </p>
      ) : null}
    </article>
  );
}
