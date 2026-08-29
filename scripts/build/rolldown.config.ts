import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/index.ts",
    output: { file: "dist/index.js", format: "esm" },
    platform: "node",
  },
  {
    input: "src/index.ts",
    output: { file: "dist/index.cjs", format: "cjs" },
    platform: "node",
  },
  {
    input: "src/cli/index.ts",
    output: { file: "dist/cli.js", format: "esm" },
    platform: "node",
  },
]);
