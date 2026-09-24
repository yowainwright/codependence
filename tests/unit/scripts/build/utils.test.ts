import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { prepareLinuxCompiler } from "../../../../scripts/build/utils";

const createCompilerFixture = (context: TestContext) => {
  const root = mkdtempSync(join(tmpdir(), "codependence-compiler-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const compilerDir = join(root, "node_modules", "@scriptc", "compiler");
  const helperDir = join(compilerDir, "node_modules", "@scriptc", "llvm-linux-x64-gnu");
  const compilerPath = join(compilerDir, "index.js");
  const helperPath = join(helperDir, "bin", "scriptc-llvm-codegen");
  mkdirSync(join(helperDir, "bin"), { recursive: true });
  writeFileSync(join(helperDir, "package.json"), "{}");
  writeFileSync(helperPath, "native helper fixture");
  return { compilerPath, helperPath };
};

test("repairs the Linux helper shipped without execute permissions", (context) => {
  const { compilerPath, helperPath } = createCompilerFixture(context);
  chmodSync(helperPath, 0o644);
  prepareLinuxCompiler(compilerPath);
  assert.equal(statSync(helperPath).mode & 0o777, 0o755);
});

test("preserves existing helper permissions across repeated builds", (context) => {
  const { compilerPath, helperPath } = createCompilerFixture(context);
  chmodSync(helperPath, 0o555);
  prepareLinuxCompiler(compilerPath);
  prepareLinuxCompiler(compilerPath);
  assert.equal(statSync(helperPath).mode & 0o777, 0o555);
});

test("fails when the installed helper binary is missing", (context) => {
  const { compilerPath, helperPath } = createCompilerFixture(context);
  rmSync(helperPath);
  assert.throws(() => prepareLinuxCompiler(compilerPath), { code: "ENOENT" });
});
