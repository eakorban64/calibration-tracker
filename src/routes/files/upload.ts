import { createFileRoute } from "@tanstack/react-router";
import { memberOf, upload } from "@/server/files";

// Private like every route not listed under `public`: the member's own
// identity decides, and viewers are refused.
export const Route = createFileRoute("/files/upload")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const actor = await memberOf(request);
        if (actor instanceof Response) return actor;
        return upload(actor, await request.formData());
      },
    },
  },
});
