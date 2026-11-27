import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { compile } from "@mdx-js/mdx";
import rehypeSlug from "rehype-slug";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import {
  transformerMetaHighlight, transformerMetaWordHighlight, transformerNotationDiff,
  transformerNotationErrorLevel, transformerNotationFocus, transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki";
import remarkGfm from "remark-gfm";
import light from "./src/styles/shiki-light.json" with { type: "json" };
import dark from "./src/styles/shiki-dark.json" with { type: "json" };
import { docsPages } from "./docs-pages.ts";
import { FRONTMATTER_REGEX } from "./src/lib/mdx/constants.ts";

const stripFrontmatter = (source: string) => source.replace(FRONTMATTER_REGEX, "");

const fenceTitle: ShikiTransformer = {
  name: "code-block-title",
  pre(node) {
    const title = this.options.meta?.__raw?.match(/\btitle="([^"]+)"/)?.[1];
    if (title) node.properties["data-title"] = title;
  },
};

let _highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!_highlighterPromise) {
    _highlighterPromise = createHighlighter({
      themes: [{ ...light, type: "light" }, { ...dark, type: "dark" }],
      langs: ["javascript", "typescript", "json", "bash", "sh", "yaml", "markdown", "text", "diff"],
    });
  }
  return _highlighterPromise;
}

const codependenceMdx = (): Plugin => ({
  name: "codependence-mdx",
  async transform(source, id) {
    if (!id.endsWith(".mdx")) return;
    const hl = await getHighlighter();
    const compiled = await compile(stripFrontmatter(source), {
      outputFormat: "program",
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeShikiFromHighlighter,
          hl,
          {
            themes: { light: light.name, dark: dark.name },
            defaultColor: false,
            defaultLanguage: "text",
            fallbackLanguage: "text",
            addLanguageClass: true,
            transformers: [
              transformerNotationDiff(), transformerNotationHighlight(), transformerNotationFocus(),
              transformerNotationErrorLevel(), transformerNotationWordHighlight(),
              transformerMetaHighlight(), transformerMetaWordHighlight(), fenceTitle,
            ],
          },
        ],
      ],
    });
    return { code: String(compiled), map: null };
  },
});

export default defineConfig({
  base: "/codependence",
  plugins: [codependenceMdx(), react(), tailwindcss(), docsPages()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
});
