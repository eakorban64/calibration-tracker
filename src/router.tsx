import { createRouter } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { messageOf } from "@/client/lib/errors";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <main className="mx-auto max-w-md px-4 py-16">
        <EmptyState kind="filtered" title="Not found" />
      </main>
    ),
    defaultErrorComponent: ({ error }) => (
      <main className="mx-auto max-w-md px-4 py-16">
        <EmptyState kind="error" title="Something went wrong" description={messageOf(error)} />
      </main>
    ),
  });
}
