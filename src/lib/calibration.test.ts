import { describe, expect, it } from "vitest";
import {
  addDays,
  calState,
  checkoutBlock,
  csvCell,
  fillCompany,
  parseEmails,
  parseOffsets,
  pointPasses,
} from "./calibration";

const on = "2026-06-15";

describe("calibration state", () => {
  it("derives current, due soon, overdue, failed", () => {
    expect(calState({ lastResult: "pass", nextDueDate: "2026-09-01" }, on)).toBe("current");
    expect(calState({ lastResult: "pass", nextDueDate: "2026-07-15" }, on)).toBe("due_soon");
    expect(calState({ lastResult: null, nextDueDate: "2026-06-14" }, on)).toBe("overdue");
    expect(calState({ lastResult: "fail", nextDueDate: "2027-01-01" }, on)).toBe("failed");
    expect(calState({ lastResult: null, nextDueDate: null }, on)).toBe("unscheduled");
  });
  it("adds the interval to the calibration date", () => {
    expect(addDays("2026-01-31", 30)).toBe("2026-03-02");
  });
  it("passes a point only inside its limits", () => {
    expect(pointPasses({ measured: 5, lower: 4.9, upper: 5.1 })).toBe(true);
    expect(pointPasses({ measured: 5.1, lower: 4.9, upper: 5.1 })).toBe(true);
    expect(pointPasses({ measured: 5.11, lower: 4.9, upper: 5.1 })).toBe(false);
  });
});

describe("crib", () => {
  const ok = { status: "active", condition: "good", holder: null, lastResult: "pass", nextDueDate: "2026-12-01" };
  it("refuses overdue, failed, out-of-service, damaged and checked-out gages", () => {
    expect(checkoutBlock(ok, on)).toBeNull();
    expect(checkoutBlock({ ...ok, nextDueDate: "2026-06-01" }, on)).toBe("Overdue");
    expect(checkoutBlock({ ...ok, lastResult: "fail" }, on)).toBe("Failed");
    expect(checkoutBlock({ ...ok, status: "out_of_service" }, on)).toBe("Out of service");
    expect(checkoutBlock({ ...ok, condition: "damaged" }, on)).toBe("Damaged");
    expect(checkoutBlock({ ...ok, holder: "Lena" }, on)).toBe("Checked out");
  });
});

describe("reminders and text", () => {
  it("parses offsets and emails", () => {
    expect(parseOffsets("7, 30 14,0,7,x")).toEqual([30, 14, 7, 0]);
    expect(parseEmails("a@b.co, bad, c@d.org;a@b.co")).toEqual(["a@b.co", "c@d.org"]);
  });
  it("fills the company name and guards CSV cells", () => {
    expect(fillCompany("By {companyName}.", "Acme")).toBe("By Acme.");
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
