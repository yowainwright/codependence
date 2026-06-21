import path from "node:path";
import { compile } from "@mdx-js/mdx";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { defineConfig, type Plugin } from "vite";

const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/;

const manualChunkPackages: Record<string, string[]> = {
  motion: ["framer-motion"],
  state: ["xstate", "@xstate/react"],
};

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return;

  for (const [chunkName, packages] of Object.entries(manualChunkPackages)) {
    if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
      return chunkName;
    }
  }
};

const stripFrontmatter = (source: string): string =>
  source.replace(FRONTMATTER_REGEX, "");

const codependenceMdx = (): Plugin => ({
  name: "codependence-mdx",
  async transform(source, id) {
    if (!id.endsWith(".mdx")) return;

    const compiled = await compile(stripFrontmatter(source), {
      outputFormat: "program",
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    });

    return {
      code: String(compiled),
      map: null,
    };
  },
});

export default defineConfig({
  base: "/codependence/",
  plugins: [codependenceMdx(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
