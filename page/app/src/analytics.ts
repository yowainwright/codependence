import type { RegisteredRouter } from "@tanstack/react-router";
import { DOCS } from "./content/docs";

const measurementId = "G-5BH1F8XBX5";

declare global {
  interface Window {
    dataLayer: IArguments[];
  }
}

function gtag(..._command: unknown[]) {
  // oxlint-disable-next-line legibility/no-standalone-array-mutations -- Google Tag intercepts pushes on the original queue.
  window.dataLayer.push(arguments);
}

export function startAnalytics(router: RegisteredRouter) {
  const productionSite = import.meta.env.PROD && location.origin === "https://jeffry.in";
  if (!productionSite) return;
  window.dataLayer ??= [];
  gtag("js", new Date());
  gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
  let previousUrl = "";
  return router.subscribe("onResolved", () => {
    const url = new URL(location.pathname.replace(/\/?$/, "/"), location.origin).href;
    if (previousUrl === url) return;
    const doc = DOCS.find(({ slug }) => url.endsWith(`/docs/${slug}/`));
    if (!doc) return;
    const title = `${doc.title} | Codependence`;
    gtag("event", "page_view", { page_location: url, page_title: title, page_referrer: previousUrl || document.referrer });
    previousUrl = url;
  });
}
