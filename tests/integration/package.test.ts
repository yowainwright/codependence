import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("npm package includes only explicitly allowed files and npm metadata", () => {
  const cwd = fileURLToPath(root);
  execFileSync("npm", ["run", "build"], { cwd, encoding: "utf8" });
  const args = ["pack", "--dry-run", "--ignore-scripts", "--json"];
  const output = execFileSync("npm", args, { cwd, encoding: "utf8" });
  const [packed] = JSON.parse(output);
  const actual = packed.files.map(({ path }: { path: string }) => path).sort();
  const expected = [...manifest.files, "package.json", "README.md", "LICENSE"].sort();
  assert.deepStrictEqual(actual, expected);
  manifest.files.forEach((path: string) => {
    assert.ok(statSync(new URL(path, root)).isFile(), `${path} must name a file`);
    assert.ok(!path.startsWith("scripts/"), "development scripts must not ship");
  });
});

test("published entry points and type dependencies are explicitly allowed", () => {
  const entryPoints = [
    manifest.main,
    manifest.module,
    manifest.types,
    ...Object.values(manifest.bin),
    ...Object.values(manifest.exports["."]),
    manifest.exports["./schema.json"],
    "src/constants.ts",
    "src/providers/constants.ts",
  ] as string[];
  entryPoints.forEach((path) =>
    assert.ok(manifest.files.includes(path.replace(/^\.\//, "")), path),
  );
});

test("developer setup is explicit rather than an installation lifecycle hook", () => {
  ["preinstall", "install", "postinstall", "prepare"].forEach((hook) => {
    assert.strictEqual(manifest.scripts[hook], undefined, hook);
  });
  assert.strictEqual(manifest.scripts["hooks:setup"], "sh scripts/setup.sh");
});
