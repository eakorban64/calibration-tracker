import { createFileRoute } from "@tanstack/react-router";
import { download, memberOf } from "@/server/files";

export const Route = createFileRoute("/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const actor = await memberOf(request);
        if (actor instanceof Response) return actor;
        return download(params.id);
      },
    },
  },
});
