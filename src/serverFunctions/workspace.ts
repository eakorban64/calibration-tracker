import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { integrationStatus } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { parseEmails } from "@/lib/calibration";
import { listActivity } from "@/server/activity";
import { actorFor, requireAdmin } from "@/server/actor";
import { sendTestDigest } from "@/server/reminders";
import * as reports from "@/server/reports";
import * as settings from "@/server/settings";

export const getDashboard = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = await actorFor(context.user);
    return { actor, ...(await reports.dashboard()) };
  });

export const getReports = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ days: z.number().int().min(1).max(730) }).parse(data))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    const [upcoming, overdue] = await Promise.all([reports.upcoming(data.days), reports.overdue()]);
    return { actor, upcoming, overdue };
  });

export const getActivity = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await actorFor(context.user);
    return listActivity(300);
  });

export const getSettings = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = await actorFor(context.user);
    const [ws, team, emailReady] = await Promise.all([
      settings.getWorkspace(),
      settings.listTeam(),
      integrationStatus({ env, provider: "email" }).then(
        (s) => s.ready,
        () => false,
      ),
    ]);
    const { orgId: _org, certCounter: _counter, ...shown } = ws;
    return { actor, workspace: shown, team, emailReady };
  });

export const saveCompany = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => settings.companyInput.parse(data))
  .handler(async ({ data, context }) => settings.saveCompany(await actorFor(context.user), data));

export const saveReminders = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => settings.remindersInput.parse(data))
  .handler(async ({ data, context }) => settings.saveReminders(await actorFor(context.user), data));

export const setRole = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => settings.roleInput.parse(data))
  .handler(async ({ data, context }) => settings.setRole(await actorFor(context.user), data));

export const testDigest = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = await actorFor(context.user);
    requireAdmin(actor);
    const ws = await settings.getWorkspace();
    const origin = new URL(getRequest().url).origin;
    return sendTestDigest(env, parseEmails(ws.digestRecipients), origin);
  });
