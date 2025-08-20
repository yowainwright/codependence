import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://jeffry.in",
  base: "/codependence",
  integrations: [mdx(), react()],
  trailingSlash: "never",
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      wrap: true
    }
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
