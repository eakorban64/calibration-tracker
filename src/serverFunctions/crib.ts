import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorFor } from "@/server/actor";
import * as crib from "@/server/crib";
import { listEquipment } from "@/server/equipment";

export const getCrib = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = await actorFor(context.user);
    const [items, history] = await Promise.all([listEquipment(), crib.cribHistory()]);
    return { actor, items, history };
  });

export const checkout = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => crib.checkoutInput.parse(data))
  .handler(async ({ data, context }) => crib.checkout(await actorFor(context.user), data));

export const checkin = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => crib.checkinInput.parse(data))
  .handler(async ({ data, context }) => crib.checkin(await actorFor(context.user), data));
