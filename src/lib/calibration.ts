// Pure rules shared by the server and the pages.

export type CalState = "current" | "due_soon" | "overdue" | "failed" | "unscheduled";

export const DUE_SOON_DAYS = 30;

export const STATE_LABEL: Record<CalState, string> = {
  current: "Current",
  due_soon: "Due soon",
  overdue: "Overdue",
  failed: "Failed",
  unscheduled: "No due date",
};

export const CONDITION_LABEL: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  out_of_service: "Out of service",
};

/** Today in UTC as YYYY-MM-DD. */
export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

export function calState(
  item: { lastResult: string | null; nextDueDate: string | null },
  on: string = today(),
): CalState {
  if (item.lastResult === "fail") return "failed";
  if (!item.nextDueDate) return "unscheduled";
  const left = daysBetween(on, item.nextDueDate);
  if (left < 0) return "overdue";
  if (left <= DUE_SOON_DAYS) return "due_soon";
  return "current";
}

export function pointPasses(p: { measured: number; lower: number; upper: number }): boolean {
  return p.measured >= p.lower && p.measured <= p.upper;
}

/** Why a gage can't leave the crib, or null when it can. */
export function checkoutBlock(
  item: {
    status: string;
    condition: string;
    holder: string | null;
    lastResult: string | null;
    nextDueDate: string | null;
  },
  on: string = today(),
): string | null {
  if (item.holder) return "Checked out";
  if (item.status === "out_of_service") return "Out of service";
  if (item.condition === "damaged") return "Damaged";
  const state = calState(item, on);
  if (state === "failed") return "Failed";
  if (state === "overdue") return "Overdue";
  return null;
}

/** "30, 14,7,0" as [30, 14, 7, 0]: whole days, no repeats, largest first. */
export function parseOffsets(text: string): number[] {
  const values = text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  return [...new Set(values)].sort((a, b) => b - a);
}

/** Comma- or space-separated email addresses, trimmed and de-duplicated. */
export function parseEmails(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    ),
  ];
}

export function formatCert(n: number): string {
  return `CT-${String(n).padStart(5, "0")}`;
}

export function fillCompany(text: string, company: string): string {
  return text.replaceAll("{companyName}", company);
}

export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
