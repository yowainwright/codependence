import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routes";
import "./styles/global.css";

const router = createRouter({
  routeTree,
  basepath: "/codependence",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
