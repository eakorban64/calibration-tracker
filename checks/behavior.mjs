// Behavior: every retained feature's main path (F001–F008), against the packaged release.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addEquipment, isoDate, pick, recordCalibration } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/equipment", "/records", "/crib", "/reports", "/activity", "/settings"]);

  // The member visits once, so the team list has them.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/");
  await expect(memberPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const page = await (await runtime.context("owner")).newPage();

  // F008: settings – company name and certificate statement.
  await page.goto("/settings");
  await page.getByTestId("company-name").fill("Northfield Precision Machining");
  await page.getByTestId("disclaimer").fill("Calibrated by {companyName} against standards traceable to national references.");
  await page.getByTestId("save-company").click();
  await expect(page.getByText("Company details saved")).toBeVisible();

  // F001: register equipment.
  await addEquipment(page, {
    name: "Outside micrometer 0–25 mm", code: "MIC-014", serial: "SN-88213", manufacturer: "Kestrel Tools",
    model: "OM-25", category: "Micrometers", location: "Inspection lab", owner: "Quality",
    ownerEmail: "quality@northfield.example", range: "0–25 mm", interval: 180,
    tolerance: "±0.002 mm", reference: "Gauge block set GB-2",
  });
  await addEquipment(page, {
    name: "Digital caliper 150 mm", code: "CAL-201", serial: "SN-88213", manufacturer: "Kestrel Tools",
    model: "DC-150", category: "Calipers", location: "Cell 3", owner: "Machining", interval: 365,
  });
  // Duplicate serial: warned, still saved (addEquipment waited for the row).
  await page.getByRole("link", { name: "CAL-201", exact: true }).click();
  await expect(page.getByTestId("duplicate-serial-warning")).toBeVisible();
  await addEquipment(page, {
    name: "Torque wrench 20–100 N·m", code: "TRQ-007", serial: "TW-5531", category: "Torque tools",
    location: "Assembly", owner: "Assembly", interval: 365, nextDue: isoDate(-12),
  });
  await addEquipment(page, {
    name: "Bore gauge 50–160 mm", code: "BOR-003", serial: "BG-1102", category: "Bore gauges",
    location: "Inspection lab", owner: "Quality", interval: 365, nextDue: isoDate(40), status: "Out of service",
  });

  // An equipment ID is unique.
  await page.getByTestId("add-equipment").click();
  await page.getByTestId("eq-name").fill("Second micrometer");
  await page.getByTestId("eq-code").fill("MIC-014");
  await page.getByTestId("eq-save").click();
  await expect(page.getByText("Equipment ID MIC-014 is already in use.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("equipment-dialog")).toHaveCount(0);

  // List: search, filter, sort.
  await page.goto("/equipment");
  await page.getByTestId("equipment-search").fill("torque");
  await expect(page.getByTestId("equipment-row")).toHaveCount(1);
  await page.getByTestId("equipment-search").fill("");
  await pick(page, "filter-location", "Inspection lab");
  await expect(page.getByTestId("equipment-row")).toHaveCount(2);
  await pick(page, "filter-location", "All locations");
  await pick(page, "filter-status", "Out of service");
  await expect(page.getByTestId("equipment-row")).toHaveCount(1);
  await expect(page.getByTestId("equipment-row")).toContainText("BOR-003");
  await pick(page, "filter-status", "All statuses");
  await pick(page, "filter-category", "Calipers");
  await expect(page.getByTestId("equipment-row")).toHaveCount(1);
  await pick(page, "filter-category", "All categories");
  await page.getByRole("button", { name: "Sort by Equipment ID" }).click();
  await expect(page.getByTestId("equipment-row").first()).toContainText("BOR-003");

  // F002: a passing calibration.
  const calDate = isoDate(-3);
  await recordCalibration(page, "MIC-014", {
    date: calDate, technician: "Dana Ruiz", procedure: "Gauge block comparison, GB-2", temperature: 20.4, humidity: 45,
    points: [
      { nominal: 5, measured: 5.001, lower: 4.998, upper: 5.002 },
      { nominal: 12.5, measured: 12.499, lower: 12.498, upper: 12.502 },
      { nominal: 25, measured: 25.001, lower: 24.998, upper: 25.002 },
    ],
    notes: "Anvils cleaned before measurement.",
  });
  await expect(page.getByTestId("record-result")).toHaveText("Pass");
  const certText = (await page.getByTestId("cert-number").textContent()).trim();
  const recordUrl = page.url();
  // Saving moved the item's dates.
  await page.getByTestId("record-equipment-link").click();
  await expect(page.getByTestId("equipment-state")).toHaveText("Current");
  await expect(page.getByTestId("equipment-last-cal")).toHaveText(calDate);
  await expect(page.getByTestId("equipment-next-due")).toHaveText(isoDate(-3 + 180));
  await expect(page.getByTestId("records-list")).toContainText(certText);

  // F001: attachment upload and download.
  await page.getByTestId("attachment-input").setInputFiles({ name: "supplier-cert.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 supplier certificate") });
  const attachmentLink = page.getByRole("link", { name: "supplier-cert.pdf" });
  await expect(attachmentLink).toBeVisible();
  const download = await runtime.fetch(await attachmentLink.getAttribute("href"), { role: "member" });
  expect(download.status).toBe(200);
  expect(await download.text()).toContain("supplier certificate");

  // F002: edits are logged.
  await page.goto(recordUrl);
  await page.getByTestId("edit-record").click();
  await page.getByTestId("rec-notes").fill("Anvils cleaned and checked for flatness.");
  await page.getByTestId("rec-save").click();
  await expect(page.getByTestId("record-notes")).toHaveText("Anvils cleaned and checked for flatness.");
  await expect(page.getByTestId("record-edited")).toBeVisible();
  await expect(page.getByTestId("cert-number")).toHaveText(certText);

  // F003: the certificate.
  await page.getByTestId("open-certificate").click();
  await expect(page.getByTestId("certificate")).toContainText("Northfield Precision Machining");
  await expect(page.getByTestId("certificate")).toContainText("Calibrated by Northfield Precision Machining against standards");
  await expect(page.getByTestId("certificate")).toContainText(certText);
  await expect(page.getByTestId("certificate")).toContainText("Dana Ruiz");
  await expect(page.getByTestId("certificate-point")).toHaveCount(3);
  await expect(page.getByTestId("print")).toBeVisible();

  // F004: the label and its QR link.
  await page.goto(recordUrl);
  await page.getByTestId("print-label").click();
  await expect(page.getByTestId("label")).toContainText("MIC-014");
  await expect(page.getByTestId("label")).toContainText(calDate);
  await expect(page.getByTestId("label")).toContainText("Dana Ruiz");
  await expect(page.getByTestId("label-qr").locator("svg")).toBeVisible();
  const qrUrl = (await page.getByTestId("label-url").textContent()).trim();
  expect(qrUrl.startsWith(`https://${runtime.hostname}/c/`) || qrUrl.startsWith(`http://${runtime.hostname}/c/`)).toBe(true);
  const publicPath = new URL(qrUrl).pathname;
  const publicView = await runtime.fetch(publicPath);
  expect(publicView.status).toBe(200);
  const publicHtml = await publicView.text();
  expect(publicHtml).toContain("MIC-014");
  expect(publicHtml).toContain(certText);
  expect(publicHtml).not.toContain("Anvils cleaned");
  expect((await runtime.fetch("/c/not-a-real-code")).status).toBe(404);

  // Phone-sized smoke: an anonymous scan of the label.
  const phone = await (await runtime.context(null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto(publicPath);
  await expect(phone.getByTestId("public-result")).toHaveText("Pass");
  await expect(phone.getByTestId("public-equipment")).toContainText("Outside micrometer");
  await phone.getByTestId("public-certificate-link").click();
  await expect(phone.getByTestId("certificate")).toContainText(certText);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // F002: a failing calibration – no label, item marked failed.
  await recordCalibration(page, "CAL-201", {
    date: isoDate(-1), technician: "Sam Okafor", procedure: "Caliper checker CC-150", temperature: 69.8, unit: "°F", humidity: 40,
    points: [
      { nominal: 50, measured: 50.01, lower: 49.98, upper: 50.02 },
      { nominal: 100, measured: 100.05, lower: 99.98, upper: 100.02 },
    ],
  });
  await expect(page.getByTestId("point-result").nth(1)).toHaveText("Fail");
  await expect(page.getByTestId("record-result")).toHaveText("Fail");
  await expect(page.getByTestId("record-environment")).toContainText("°F");
  await expect(page.getByTestId("print-label")).toHaveCount(0);
  await page.getByTestId("record-equipment-link").click();
  await expect(page.getByTestId("equipment-state")).toHaveText("Failed");

  // Records list: filters and CSV.
  await page.goto("/records");
  await expect(page.getByTestId("record-row")).toHaveCount(2);
  await pick(page, "filter-result", "Fail");
  await expect(page.getByTestId("record-row")).toHaveCount(1);
  await expect(page.getByTestId("record-row")).toContainText("CAL-201");
  await pick(page, "filter-result", "All results");
  await page.getByTestId("filter-from").fill(isoDate(-2));
  await expect(page.getByTestId("record-row")).toHaveCount(1);
  const csv = await runtime.fetch("/export/records.csv", { role: "member" });
  expect(csv.status).toBe(200);
  expect(csv.headers.get("content-type")).toContain("text/csv");
  const csvText = await csv.text();
  expect(csvText).toContain("Certificate");
  expect(csvText).toContain("MIC-014");
  expect(csvText).toContain("CAL-201");
  const failedOnly = await (await runtime.fetch("/export/records.csv?result=fail", { role: "member" })).text();
  expect(failedOnly).not.toContain("MIC-014");

  // F007: tool crib.
  await page.goto("/crib");
  await page.getByTestId("checkout-MIC-014").click();
  await page.getByTestId("crib-person").fill("Lena Hart");
  await page.getByTestId("crib-return").fill(isoDate(5));
  await page.getByTestId("crib-confirm").click();
  await expect(page.getByTestId("crib-row-MIC-014")).toContainText("Lena Hart");
  await expect(page.getByTestId("checkout-MIC-014")).toHaveCount(0);
  await expect(page.getByTestId("checkout-blocked-CAL-201")).toContainText("Failed");
  await expect(page.getByTestId("checkout-blocked-TRQ-007")).toContainText("Overdue");
  await expect(page.getByTestId("checkout-blocked-BOR-003")).toContainText("Out of service");
  await page.getByTestId("crib-view-out").click();
  await expect(page.getByTestId("crib-row-MIC-014")).toBeVisible();
  await expect(page.getByTestId("crib-row-CAL-201")).toHaveCount(0);
  await page.getByTestId("crib-view-all").click();
  await page.getByTestId("crib-needs-cal").click();
  await expect(page.getByTestId("crib-row-TRQ-007")).toBeVisible();
  await expect(page.getByTestId("crib-row-MIC-014")).toHaveCount(0);
  await page.getByTestId("crib-needs-cal").click();
  await page.getByTestId("checkin-MIC-014").click();
  await pick(page, "crib-condition", "Fair");
  await page.getByTestId("crib-confirm").click();
  await expect(page.getByTestId("checkout-MIC-014")).toBeVisible();
  await expect(page.getByTestId("crib-row-MIC-014")).toContainText("Fair");
  await expect(page.getByTestId("crib-history")).toContainText("Lena Hart");
  await page.goto("/equipment");
  await page.getByRole("link", { name: "MIC-014", exact: true }).click();
  await page.getByRole("tab", { name: "Crib history" }).click();
  await expect(page.getByTestId("equipment-crib-history")).toContainText("Lena Hart");

  // F005: dashboard counts and reports.
  await page.goto("/");
  await expect(page.getByTestId("count-overdue")).toHaveText("1");
  await expect(page.getByTestId("count-out-of-service")).toHaveText("1");
  await expect(page.getByTestId("recent-activity")).toContainText("MIC-014");
  await page.getByTestId("card-overdue").click();
  await expect(page.getByTestId("equipment-row")).toHaveCount(1);
  await expect(page.getByTestId("equipment-row")).toContainText("TRQ-007");
  await page.goto("/reports");
  await expect(page.getByTestId("overdue-row")).toContainText("TRQ-007");
  await expect(page.getByTestId("overdue-row")).toContainText("12");
  await pick(page, "report-window", "Next 365 days");
  await expect(page.getByTestId("upcoming-list")).toContainText("MIC-014");
  await page.getByTestId("overdue-row").getByRole("link", { name: "Record calibration" }).click();
  await expect(page.getByTestId("rec-date")).toBeVisible();
  const overdueCsv = await runtime.fetch("/export/overdue.csv", { role: "owner" });
  expect(overdueCsv.status).toBe(200);
  expect(await overdueCsv.text()).toContain("TRQ-007");
  expect(await (await runtime.fetch("/export/upcoming.csv?days=365", { role: "owner" })).text()).toContain("MIC-014");

  // F006: reminders, with email not set up on this Gateway.
  await page.goto("/settings");
  await pick(page, "reminder-mode", "Weekly digest");
  await page.getByTestId("digest-recipients").fill("quality@northfield.example");
  await page.getByTestId("save-reminders").click();
  await expect(page.getByText("Reminder settings saved")).toBeVisible();
  await page.getByTestId("test-digest").click();
  await expect(page.getByTestId("digest-preview")).toContainText("TRQ-007");
  await expect(page.getByTestId("email-status")).toBeVisible();
  await pick(page, "reminder-mode", "Before each due date");
  await page.getByTestId("reminder-offsets").fill("30, 14, 7, 0");
  await page.getByTestId("reminder-cc").fill("lab-lead@northfield.example");
  await page.getByTestId("save-reminders").click();
  await expect(page.getByText("Reminder settings saved")).toBeVisible();
  await runtime.scheduled("*/15 * * * *");
  const calls = await runtime.gatewayCalls();
  expect(calls.some((c) => /email/i.test(c.path) || /TRQ-007/.test(c.body ?? ""))).toBe(true);
  const db = await runtime.database();
  const sent = await db.prepare("select count(*) as n from reminder_log").first();
  expect(sent.n).toBe(0);

  // F008: roles and activity.
  await page.goto("/settings");
  await expect(page.getByTestId("team-row")).toHaveCount(2);
  await page.goto("/activity");
  await expect(page.getByTestId("activity-list")).toContainText("MIC-014");
  await expect(page.getByTestId("activity-list")).toContainText("Checked out");
  await expect(page.getByTestId("activity-list")).toContainText("Updated calibration");
  await expect(page.getByTestId("activity-list")).toContainText("settings");

  // The journey's picture: the register with real items.
  await page.goto("/equipment");
  await runtime.assertBackLink(page);
  await expect(page.getByTestId("equipment-row")).toHaveCount(4);
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
