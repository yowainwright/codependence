import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { compile } from "@mdx-js/mdx";
import rehypeSlug from "rehype-slug";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighter, type Highlighter } from "shiki";
import remarkGfm from "remark-gfm";
import { FRONTMATTER_REGEX } from "./src/lib/mdx/constants";

const stripFrontmatter = (source: string) =>
  source.replace(FRONTMATTER_REGEX, "");

let _highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!_highlighterPromise) {
    _highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "json",
        "bash",
        "sh",
        "yaml",
        "markdown",
        "text",
        "diff",
      ],
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
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
          },
        ],
      ],
    });
    return { code: String(compiled), map: null };
  },
});

export default defineConfig({
  base: "/codependence",
  plugins: [codependenceMdx(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
});
