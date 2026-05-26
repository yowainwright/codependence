#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const result = spawnSync("codependence", process.argv.slice(2), {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
