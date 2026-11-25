import type { Plugin } from "vite";
import manifest from "../../package.json" with { type: "json" };
import { DOCS } from "./src/content/docs.ts";

const site = new URL(manifest.homepage + "/");
const marker = "<!-- Page metadata -->";
const home = { title: "Codependence", description: manifest.description, url: site.href };
const pages = DOCS.map(({ slug, title, description }) => {
  const directory = `docs/${slug}/`;
  const url = new URL(directory, site).href;
  return { directory, title: `${title} | Codependence`, description, url };
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderPage(template: string, page: typeof home) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const url = escapeHtml(page.url);
  const head = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
  ];
  return template.replace(marker, () => head.join("\n    "));
}

export function docsPages(): Plugin {
  return {
    name: "docs-pages",
    enforce: "post",
    transformIndexHtml(html, context) {
      if (!context.server) return html;
      const pathname = new URL(context.originalUrl ?? context.path, site).pathname.replace(/\/?$/, "/");
      const page = pages.find(({ url }) => new URL(url).pathname === pathname);
      return renderPage(html, page ?? home);
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset") this.error("Missing docs HTML template");
        const template = index.source;
        if (typeof template !== "string") this.error("Expected an HTML string");
        index.source = renderPage(template, home);
        for (const page of pages) {
          this.emitFile({ type: "asset", fileName: page.directory + "index.html", source: renderPage(template, page) });
        }
        const urls = pages.map(({ url }) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n");
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      },
    },
  };
}
