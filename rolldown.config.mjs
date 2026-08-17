import { defineConfig } from "rolldown";

const nodeBuild = (input, file, format = "esm") => {
  const output = { file, format };
  return { input, output, platform: "node" };
};

export default defineConfig([
  nodeBuild("src/index.ts", "dist/index.js"),
  nodeBuild("src/index.ts", "dist/index.cjs", "cjs"),
  nodeBuild("src/cli.ts", "dist/cli.js"),
]);
