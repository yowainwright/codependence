import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { preview } from "vite";

const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));
let previewServer;
let previewOrigin;

function getInlineScript(html) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "HTML should include an inline script");
  return script;
}

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(String(key)) ?? null;
    },
    removeItem(key) {
      const normalizedKey = String(key);
      values.delete(normalizedKey);
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

function executeFallback(html, requestedUrl, sessionStorage) {
  let redirectTarget;
  const context = {
    sessionStorage,
    window: {
      location: {
        hash: requestedUrl.hash,
        pathname: requestedUrl.pathname,
        replace(target) {
          redirectTarget = target;
        },
        search: requestedUrl.search,
      },
    },
  };
  runInNewContext(getInlineScript(html), context);
  return redirectTarget;
}

function restoreRoute(html, sessionStorage) {
  let restoredRoute;
  const context = {
    document: { documentElement: { setAttribute() {} } },
    history: {
      replaceState(_state, _title, path) {
        restoredRoute = path;
      },
    },
    localStorage: { getItem: () => null },
    sessionStorage,
    window: { matchMedia: () => ({ matches: false }) },
  };
  runInNewContext(getInlineScript(html), context);
  return restoredRoute;
}

before(async () => {
  previewServer = await preview({
    root: APP_ROOT,
    logLevel: "silent",
    preview: { host: "127.0.0.1", port: 0 },
  });

  const address = previewServer.httpServer.address();
  assert.ok(address && typeof address !== "string");
  previewOrigin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await previewServer?.close();
});

test("serves the built app shell and its entry bundle", async () => {
  const pageUrl = new URL("/codependence/", previewOrigin);
  const pageResponse = await fetch(pageUrl);
  assert.equal(pageResponse.status, 200);

  const html = await pageResponse.text();
  const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  assert.ok(scriptPath, "built HTML should reference its JavaScript entry");

  const scriptResponse = await fetch(new URL(scriptPath, previewOrigin));
  assert.equal(scriptResponse.status, 200);
  assert.match(scriptResponse.headers.get("content-type") ?? "", /javascript/);
});

test("serves the app shell for a documentation deep link", async () => {
  const pageUrl = new URL("/codependence/docs/introduction", previewOrigin);
  const pageResponse = await fetch(pageUrl);

  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /<div id="root"><\/div>/);
});

test("restores a GitHub Pages deep link with its query and hash", async () => {
  const fallbackResponse = await fetch(new URL("/codependence/404.html", previewOrigin));
  assert.equal(fallbackResponse.status, 200);
  const fallbackHtml = await fallbackResponse.text();
  const requestedRoute = "/codependence/docs/cli?source=smoke#usage";
  const requestedUrl = new URL(requestedRoute, previewOrigin);
  const sessionStorage = createSessionStorage();
  const redirectTarget = executeFallback(fallbackHtml, requestedUrl, sessionStorage);

  assert.equal(redirectTarget, "/codependence/");
  assert.equal(sessionStorage.getItem("spa-redirect"), requestedRoute);

  const pageResponse = await fetch(new URL("/codependence/", previewOrigin));
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  const restoredRoute = restoreRoute(html, sessionStorage);

  assert.equal(restoredRoute, requestedRoute);
  assert.equal(sessionStorage.getItem("spa-redirect"), null);
});
