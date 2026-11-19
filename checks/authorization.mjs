// Authorization: private paths, the public QR view, viewer and admin-only rules, no sign-in of the app's own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addEquipment, captureServerCall, isoDate, pick, recordCalibration } from "./helpers.mjs";

// A server function answers a refusal with its error, whatever the status.
async function refused(response) {
  return response.status >= 400 || (await response.text()).includes("Error");
}

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/equipment", "/records", "/crib", "/reports", "/activity", "/settings", "/export/records.csv"]);
  const db = await runtime.database();

  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/");
  await expect(memberPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const owner = await (await runtime.context("owner")).newPage();
  await addEquipment(owner, { name: "Height gauge 300 mm", code: "HG-300", serial: "HG-9", category: "Height gauges", location: "Lab", interval: 365 });
  await recordCalibration(owner, "HG-300", {
    date: isoDate(-2), technician: "Dana Ruiz", procedure: "Surface plate check", temperature: 20, humidity: 50,
    points: [{ nominal: 100, measured: 100.001, lower: 99.99, upper: 100.01 }], notes: "Internal note only",
  });
  const recordPath = new URL(owner.url()).pathname;
  await owner.getByTestId("print-label").click();
  const publicPath = new URL((await owner.getByTestId("label-url").textContent()).trim()).pathname;

  // Attachment for download checks.
  await owner.goto("/equipment");
  await owner.getByRole("link", { name: "HG-300", exact: true }).click();
  await owner.getByTestId("attachment-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("not really a png") });
  const fileHref = await owner.getByRole("link", { name: "photo.png" }).getAttribute("href");
  const equipmentPath = new URL(owner.url()).pathname;

  // Anonymous and outsider: refused everywhere private.
  for (const path of [recordPath, equipmentPath, fileHref, `${recordPath}/certificate`, "/export/overdue.csv"]) {
    for (const role of [undefined, "outsider"]) {
      const res = await runtime.fetch(path, role ? { role } : {});
      expect([401, 403]).toContain(res.status);
    }
  }
  // Uploads refused to anonymous callers.
  const anonUpload = await runtime.fetch("/files/upload", { method: "POST", body: new FormData() });
  expect([401, 403]).toContain(anonUpload.status);

  // Public view shows only the record summary.
  const pub = await runtime.fetch(publicPath);
  expect(pub.status).toBe(200);
  const html = await pub.text();
  expect(html).toContain("HG-300");
  expect(html).not.toContain("Internal note only");
  expect(html).not.toContain("photo.png");
  expect((await runtime.fetch(`${publicPath}/certificate`)).status).toBe(200);
  expect((await runtime.fetch("/c/zzzzzzzzzzzz")).status).toBe(404);
  expect((await runtime.fetch("/c/zzzzzzzzzzzz/certificate")).status).toBe(404);
  const pubPost = await runtime.fetch(publicPath, { method: "POST", body: "x" });
  expect(pubPost.status).not.toBe(200);

  // No sign-in of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/logout"]) {
    const res = await runtime.fetch(path, { role: "owner" });
    expect(res.status).toBe(404);
  }

  // Capture owner actions to replay as the member.
  await owner.goto("/settings");
  await owner.getByTestId("company-name").fill("Owner Set Name");
  const saveCompany = await captureServerCall(owner, () => owner.getByTestId("save-company").click());
  await expect(owner.getByText("Company details saved")).toBeVisible();

  // Admin-only: a member (technician) cannot change settings, reminders or roles.
  await memberPage.goto("/settings");
  await expect(memberPage.getByTestId("save-company")).toHaveCount(0);
  await expect(memberPage.getByTestId("save-reminders")).toHaveCount(0);
  await expect(memberPage.getByTestId("team-role-select")).toHaveCount(0);
  const memberSave = await runtime.fetch(saveCompany.path, {
    role: "member", method: "POST", headers: saveCompany.headers,
    body: saveCompany.body.replace("Owner Set Name", "Member Hijack"),
  });
  expect(await refused(memberSave)).toBe(true);
  const company = await db.prepare("select company_name from workspace").first();
  expect(company.company_name).toBe("Owner Set Name");

  // Owner makes the member a viewer, capturing the role change.
  const memberRow = owner.getByTestId("team-row").filter({ hasNot: owner.getByText("Admin", { exact: true }) });
  await expect(memberRow).toHaveCount(1);
  await memberRow.getByTestId("team-role-select").click();
  const roleCall = await captureServerCall(owner, () => owner.getByRole("option", { name: "Viewer", exact: true }).click());
  await expect(memberRow).toContainText("Viewer");
  // The member can't promote themselves back.
  const selfPromote = await runtime.fetch(roleCall.path, {
    role: "member", method: "POST", headers: roleCall.headers, body: roleCall.body.replace("viewer", "technician"),
  });
  expect(await refused(selfPromote)).toBe(true);
  const viewers = await db.prepare("select count(*) as n from members where role = 'viewer'").first();
  expect(viewers.n).toBe(1);

  // Capture an equipment create by the owner, then replay as the viewer.
  await owner.goto("/equipment");
  await owner.getByTestId("add-equipment").click();
  await owner.getByTestId("eq-name").fill("Dial indicator");
  await owner.getByTestId("eq-code").fill("DI-001");
  await owner.getByTestId("eq-interval").fill("365");
  const createCall = await captureServerCall(owner, () => owner.getByTestId("eq-save").click());
  await expect(owner.getByRole("link", { name: "DI-001", exact: true })).toBeVisible();
  const replay = await runtime.fetch(createCall.path, {
    role: "member", method: "POST", headers: createCall.headers, body: createCall.body.replaceAll("DI-001", "DI-999"),
  });
  expect(await refused(replay)).toBe(true);
  const hijacked = await db.prepare("select count(*) as n from equipment where code = 'DI-999'").first();
  expect(hijacked.n).toBe(0);

  // The viewer reads but sees no write controls, and uploads are refused.
  await memberPage.goto("/equipment");
  await expect(memberPage.getByTestId("equipment-row")).toHaveCount(2);
  await expect(memberPage.getByTestId("add-equipment")).toHaveCount(0);
  await memberPage.getByRole("link", { name: "HG-300", exact: true }).click();
  await expect(memberPage.getByTestId("record-calibration")).toHaveCount(0);
  await expect(memberPage.getByTestId("attachment-input")).toHaveCount(0);
  const equipmentId = equipmentPath.split("/").pop();
  const form = new FormData();
  form.set("equipmentId", equipmentId);
  form.set("file", new Blob(["x"], { type: "text/plain" }), "viewer.txt");
  const viewerUpload = await runtime.fetch("/files/upload", { role: "member", method: "POST", body: form });
  expect(viewerUpload.status).toBe(403);
  await memberPage.goto("/crib");
  await expect(memberPage.getByTestId("checkout-HG-300")).toHaveCount(0);
  // The viewer can still read records and download files.
  expect((await runtime.fetch(fileHref, { role: "member" })).status).toBe(200);
  expect((await runtime.fetch("/export/records.csv", { role: "member" })).status).toBe(200);
} finally {
  await runtime.close();
}
