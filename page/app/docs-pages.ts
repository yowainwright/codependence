import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { evaluate } from "@mdx-js/mdx";
import { createElement, type ComponentPropsWithoutRef } from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import manifest from "../../package.json" with { type: "json" };
import { DOCS } from "./src/content/docs.ts";
import { FRONTMATTER_REGEX } from "./src/lib/mdx/constants.ts";
import type { CodeDemoProps } from "./src/components/docs/CodeDemo.tsx";
import { DocBlockquote } from "./src/components/docs/MDXComponents/DocBlockquote.tsx";

const site = new URL(manifest.homepage + "/");
const marker = "<!-- Page metadata -->";
const home = { title: "Codependence", description: manifest.description, url: site.href };
const pages = DOCS.map(({ slug, title, description }) => {
  const directory = `docs/${slug}/`;
  const url = new URL(directory, site).href;
  return { slug, heading: title, directory, title: `${title} | Codependence`, description, url };
});

function staticLink({ href, ...props }: ComponentPropsWithoutRef<"a">) {
  const url = href?.startsWith("/docs/") ? site.pathname + href.slice(1) : href;
  return createElement("a", { ...props, href: url });
}

function staticDemo({ label, children, steps }: CodeDemoProps) {
  const notes = steps.map(({ line, label, note }) =>
    createElement("li", { key: line }, createElement("strong", null, label), " — ", note),
  );
  return createElement("section", { "aria-label": label }, children, createElement("ol", null, notes));
}

async function renderArticle(page: (typeof pages)[number]) {
  const file = new URL(`./src/content/docs/${page.slug}.mdx`, import.meta.url);
  const source = await readFile(file, "utf8");
  const { default: Content } = await evaluate(source.replace(FRONTMATTER_REGEX, ""), {
    ...jsx, remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug],
  });
  const components = { a: staticLink, blockquote: DocBlockquote, CodeDemo: staticDemo };
  const content = renderToStaticMarkup(createElement(Content, { components }));
  if (page.slug === "introduction") return `<article>${content}</article>`;
  return `<article><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p>${content}</article>`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderPage(template: string, page: typeof home, article = "") {
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
  const html = template.replace(marker, () => head.join("\n    "));
  return html.replace("<!-- Static documentation -->", () => article);
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
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset") this.error("Missing docs HTML template");
        const template = index.source;
        if (typeof template !== "string") this.error("Expected an HTML string");
        const links = pages.map(({ url, heading }) => `<li><a href="${escapeHtml(url)}">${escapeHtml(heading)}</a></li>`);
        index.source = renderPage(template, home, `<h1>Codependence</h1><nav><ul>${links.join("")}</ul></nav>`);
        for (const page of pages) {
          const article = await renderArticle(page);
          this.emitFile({ type: "asset", fileName: page.directory + "index.html", source: renderPage(template, page, article) });
        }
        const urls = pages.map(({ url }) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n");
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      },
    },
  };
}
