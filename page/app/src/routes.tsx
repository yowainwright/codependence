import { lazy, Suspense } from "react";
import { createRootRoute, createRoute, Outlet, redirect } from "@tanstack/react-router";

const DocsLayout = lazy(() =>
  import("./layouts/DocsLayout").then((m) => ({ default: m.DocsLayout })),
);
const DocsPage = lazy(() => import("./pages/DocsPage").then((m) => ({ default: m.DocsPage })));

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/docs/$slug", params: { slug: "introduction" }, replace: true });
  },
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$slug",
  component: () => (
    <Suspense
      fallback={
        <section className="min-h-screen flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </section>
      }
    >
      <DocsLayout>
        <DocsPage />
      </DocsLayout>
    </Suspense>
  ),
});

export const routeTree = rootRoute.addChildren([indexRoute, docsRoute]);
