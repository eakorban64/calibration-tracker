// Shared steps for the suites: pick from a select, add equipment, record a calibration.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function pick(page, testId, label) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

/** Adds an item from the equipment list and waits for its row. */
export async function addEquipment(page, item) {
  await page.goto("/equipment");
  await page.getByTestId("add-equipment").click();
  const fields = {
    "eq-name": item.name,
    "eq-code": item.code,
    "eq-serial": item.serial ?? "",
    "eq-manufacturer": item.manufacturer ?? "",
    "eq-model": item.model ?? "",
    "eq-category": item.category ?? "",
    "eq-location": item.location ?? "",
    "eq-owner": item.owner ?? "",
    "eq-owner-email": item.ownerEmail ?? "",
    "eq-range": item.range ?? "",
    "eq-interval": String(item.interval ?? 365),
    "eq-tolerance": item.tolerance ?? "",
    "eq-reference": item.reference ?? "",
  };
  for (const [id, value] of Object.entries(fields)) {
    if (value) await page.getByTestId(id).fill(value);
  }
  if (item.nextDue) await page.getByTestId("eq-next-due").fill(item.nextDue);
  if (item.condition) await pick(page, "eq-condition", item.condition);
  if (item.status) await pick(page, "eq-status", item.status);
  await page.getByTestId("eq-save").click();
  await expect(page.getByTestId("equipment-dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: item.code, exact: true })).toBeVisible();
}

/** From an item's page, records a calibration with the given points; ends on the record's page. */
export async function recordCalibration(page, code, rec) {
  await page.goto("/equipment");
  await page.getByRole("link", { name: code, exact: true }).click();
  await expect(page.getByTestId("equipment-code")).toHaveText(code);
  await page.getByTestId("record-calibration").click();
  await page.getByTestId("rec-date").fill(rec.date);
  await page.getByTestId("rec-technician").fill(rec.technician);
  await page.getByTestId("rec-procedure").fill(rec.procedure);
  await page.getByTestId("rec-temperature").fill(String(rec.temperature));
  if (rec.unit) await pick(page, "rec-unit", rec.unit);
  await page.getByTestId("rec-humidity").fill(String(rec.humidity));
  for (const [i, p] of rec.points.entries()) {
    if (i > 0) await page.getByTestId("add-point").click();
    await page.getByTestId(`point-nominal-${i}`).fill(String(p.nominal));
    await page.getByTestId(`point-measured-${i}`).fill(String(p.measured));
    await page.getByTestId(`point-lower-${i}`).fill(String(p.lower));
    await page.getByTestId(`point-upper-${i}`).fill(String(p.upper));
  }
  if (rec.adjusted) await page.getByTestId("rec-adjusted").click();
  if (rec.notes) await page.getByTestId("rec-notes").fill(rec.notes);
  const seen = [];
  const note = (m) => seen.push(m);
  page.on("pageerror", (e) => note(`pageerror ${e.message}`));
  page.on("console", (m) => m.type() === "error" && note(`console ${m.text()}`));
  page.on("response", async (r) => r.url().includes("/_serverFn/") && note(`fn ${r.status()} ${(await r.text().catch(() => "")).slice(0, 300)}`));
  await page.getByTestId("rec-save").click();
  await expect(page.getByTestId("cert-number")).toBeVisible().catch(async (error) => {
    // Say why the save didn't land: the toast the page showed.
    const toasts = await page.locator("[data-sonner-toast]").allTextContents();
    const shown = await page.evaluate(() => [...document.querySelectorAll("input,select,textarea,button[type=submit]")].filter((e) => e.checkValidity && !e.checkValidity()).map((e) => e.outerHTML.slice(0, 200)).join(" ; ") || "all fields valid");
    throw new Error(`Record not saved at ${page.url()}. Page said: ${toasts.join(" | ") || "nothing"}; ${shown}; ${seen.join(" ; ")}\n${error.message}`);
  });
}

/** Captures the next server-function call the action makes, to replay it as someone else. */
export async function captureServerCall(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/_serverFn/")),
    action(),
  ]);
  const headers = { ...(await request.allHeaders()) };
  for (const name of ["cookie", "host", "content-length", "origin", "referer"]) delete headers[name];
  const url = new URL(request.url());
  return { path: url.pathname + url.search, headers, body: request.postData() };
}
