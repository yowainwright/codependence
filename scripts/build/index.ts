import { buildBin, buildDist, resolveBuildMode } from "./utils";

const run = (): void => {
  const mode = resolveBuildMode(process.argv[2]);
  if (mode === "bin") {
    buildBin();
    return;
  }

  buildDist();
};

run();
