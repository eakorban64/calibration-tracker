// Persistence: equipment, a record with its certificate number, a crib movement and a file survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addEquipment, isoDate, recordCalibration } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  let page = await (await runtime.context("owner")).newPage();
  await addEquipment(page, { name: "Pressure gauge 0–10 bar", code: "PG-010", serial: "PG-77", category: "Pressure", location: "Test bay", interval: 90 });
  await recordCalibration(page, "PG-010", {
    date: isoDate(-1), technician: "Ari Chen", procedure: "Deadweight tester DW-1", temperature: 21, humidity: 38,
    points: [{ nominal: 5, measured: 5.01, lower: 4.95, upper: 5.05 }],
  });
  const cert = (await page.getByTestId("cert-number").textContent()).trim();
  const recordUrl = new URL(page.url()).pathname;
  await page.getByTestId("record-equipment-link").click();
  await page.getByTestId("attachment-input").setInputFiles({ name: "range-chart.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF chart") });
  await expect(page.getByRole("link", { name: "range-chart.pdf" })).toBeVisible();
  await page.goto("/crib");
  await page.getByTestId("checkout-PG-010").click();
  await page.getByTestId("crib-person").fill("Mo Patel");
  await page.getByTestId("crib-return").fill(isoDate(3));
  await page.getByTestId("crib-confirm").click();
  await expect(page.getByTestId("crib-row-PG-010")).toContainText("Mo Patel");

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto(recordUrl);
  await expect(page.getByTestId("cert-number")).toHaveText(cert);
  await page.getByTestId("record-equipment-link").click();
  await expect(page.getByTestId("equipment-next-due")).toHaveText(isoDate(-1 + 90));
  const href = await page.getByRole("link", { name: "range-chart.pdf" }).getAttribute("href");
  expect(await (await runtime.fetch(href, { role: "owner" })).text()).toContain("%PDF chart");
  await page.goto("/crib");
  await expect(page.getByTestId("crib-row-PG-010")).toContainText("Mo Patel");
} finally {
  await runtime.close();
}
