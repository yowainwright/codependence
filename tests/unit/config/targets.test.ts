import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertMatches, assertThrows, match } from "../../helpers/assertions";
import { expandTargets, normalizeConfigShape } from "../../../src/config";

test("normalizes named manifest config for the existing target runner", () => {
  const config = {
    config: {
      web: {
        name: "@project/web",
        path: "packages/web/package.json",
        manager: "pnpm",
        mode: "precise",
      },
    },
  };

  assert.deepStrictEqual((normalizeConfigShape(config, "/repo")), {
    targets: [
      {
        files: ["packages/web/package.json"],
        manager: "pnpm",
        mode: "precise",
        rootDir: "/repo",
      },
    ],
  });
});

describe("expandTargets", () => {
  test("keeps legacy flat options as one target", () => {
    const options = {
      language: "nodejs" as const,
      files: ["package.json"],
      mode: "precise" as const,
    };

    assert.deepStrictEqual((expandTargets(options)), [options]);
  });

  test("maps manager policies to independent provider runs", () => {
    const targets = expandTargets({
      update: true,
      targets: [
        {
          manager: "bun",
          files: ["package.json"],
          codependencies: ["typescript"],
        },
        {
          manager: "github-actions",
          files: [".github/workflows/*.yml"],
          mode: "precise",
        },
      ],
    });

    assertMatches((targets), [
      match.objectContaining({
        language: "nodejs",
        packageManager: "bun",
        files: ["package.json"],
        codependencies: ["typescript"],
        update: true,
      }),
      match.objectContaining({
        language: "github-actions",
        packageManager: "github-actions",
        files: [".github/workflows/*.yml"],
        mode: "precise",
        update: true,
      }),
    ]);
  });

  test("runs only explicitly selected managers", () => {
    const targets = expandTargets({
      target: ["go"],
      targets: [
        { manager: "bun", mode: "precise" },
        { manager: "go", mode: "precise" },
      ],
    });

    assertMatches((targets), [
      match.objectContaining({
        packageManager: "go",
      }),
    ]);
  });

  test("rejects unknown configured target selections", () => {
    assertThrows(() =>
      expandTargets({
        target: ["services"],
        targets: [{ manager: "go", mode: "precise" }],
      }), "Unknown target manager(s): services");
  });

  test("rejects target selection without named configuration targets", () => {
    assertThrows(() =>
      expandTargets({
        target: ["services"],
        language: "go",
        mode: "precise",
      }), "Unknown target manager(s): services");
  });

  test("uses manager-scoped Python manifest defaults", () => {
    const targets = expandTargets({
      targets: [
        { manager: "pip", mode: "precise" },
        { manager: "pipenv", mode: "precise" },
        { manager: "poetry", mode: "precise" },
        { manager: "uv", mode: "precise" },
        { manager: "conda", mode: "precise" },
      ],
    });

    assert.deepStrictEqual((targets.map(({ files }) => files)), [
      ["requirements.txt"],
      ["Pipfile"],
      ["pyproject.toml"],
      ["pyproject.toml"],
      ["environment.yml", "environment.yaml"],
    ]);
  });

  test("inherits shared scope options and allows target overrides", () => {
    const targets = expandTargets({
      rootDir: "/repo",
      ignore: ["**/generated/**"],
      targets: [
        { manager: "go", mode: "precise" },
        {
          manager: "bun",
          mode: "precise",
          rootDir: "/repo/frontend",
          ignore: ["**/.cache/**"],
        },
      ],
    });

    assertMatches((targets), [
      match.objectContaining({
        packageManager: "go",
        rootDir: "/repo",
        ignore: ["**/generated/**"],
      }),
      match.objectContaining({
        packageManager: "bun",
        rootDir: "/repo/frontend",
        ignore: ["**/.cache/**"],
      }),
    ]);
  });

  test("inherits shared lockfile enforcement and allows target opt-out", () => {
    const targets = expandTargets({
      lockfile: true,
      targets: [
        { manager: "bun", mode: "precise" },
        { manager: "go", lockfile: false, mode: "precise" },
      ],
    });

    assert.deepStrictEqual((targets.map(({ lockfile }) => lockfile)), [true, false]);
  });
});
