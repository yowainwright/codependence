import { test } from "node:test";
import assert from "node:assert/strict";
import { runReleaseCli } from "../../../../scripts/release";

test("rejects legacy formula generation and tap writes", async () => {
  const commands = ["generate", "generate-local", "check-state", "update-tap"];
  for (const command of commands) {
    await assert.rejects(runReleaseCli(["brew", command]), {
      message: "Homebrew formulas are managed by yowainwright/homebrew-tap",
    });
  }
});
