import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { runReminders } from "./server/reminders";
import { tools } from "./tools";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401), and serves the tools.
export default {
  ...everyApp<Env>(async (request) => tanstackEntry.fetch(request), { tools }),
  // Calibration reminders, on the cron in cloudflare.config.ts.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env));
  },
};
