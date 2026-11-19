import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { actorFor } from "@/server/actor";
import * as equipment from "@/server/equipment";

export const getEquipmentList = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = await actorFor(context.user);
    return { actor, items: await equipment.listEquipment() };
  });

export const getEquipmentDetail = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    return { actor, detail: await equipment.getEquipment(data.id) };
  });

export const saveEquipment = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => equipment.equipmentInput.parse(data))
  .handler(async ({ data, context }) =>
    equipment.saveEquipment(await actorFor(context.user), data),
  );
