import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));
let previewServer;
let previewOrigin;

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

test("ships the GitHub Pages deep-link fallback", async () => {
  const fallbackUrl = new URL("/codependence/404.html", previewOrigin);
  const fallbackResponse = await fetch(fallbackUrl);

  assert.equal(fallbackResponse.status, 200);
  const fallbackHtml = await fallbackResponse.text();
  assert.match(fallbackHtml, /sessionStorage\.setItem\("spa-redirect"/);
  assert.match(fallbackHtml, /window\.location\.replace\("\/codependence\/"\)/);
});
