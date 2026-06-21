import { lazy, Suspense } from "react";
import { createRootRoute, createRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { DocsLayout } from "@/layouts/DocsLayout";
import { HomePage } from "@/pages/HomePage";

const DocsPage = lazy(() => import("@/pages/DocsPage").then((m) => ({ default: m.DocsPage })));

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <AppLayout>
      <HomePage />
    </AppLayout>
  ),
});

const docsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: () => <Navigate to="/docs/$slug" params={{ slug: "introduction" }} />,
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$slug",
  component: () => (
    <DocsLayout>
      <Suspense
        fallback={
          <section className="flex min-h-[60vh] items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </section>
        }
      >
        <DocsPage />
      </Suspense>
    </DocsLayout>
  ),
});

export const routeTree = rootRoute.addChildren([indexRoute, docsIndexRoute, docsRoute]);
