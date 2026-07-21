import { describe, expect, test } from "bun:test";
import { expandTargets } from "../../../src/config";

describe("expandTargets", () => {
  test("keeps legacy flat options as one target", () => {
    const options = {
      language: "nodejs" as const,
      files: ["package.json"],
      mode: "precise" as const,
    };

    expect(expandTargets(options)).toEqual([options]);
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

    expect(targets).toEqual([
      expect.objectContaining({
        language: "nodejs",
        packageManager: "bun",
        files: ["package.json"],
        codependencies: ["typescript"],
        update: true,
      }),
      expect.objectContaining({
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

    expect(targets).toEqual([
      expect.objectContaining({
        packageManager: "go",
      }),
    ]);
  });

  test("rejects unknown configured target selections", () => {
    expect(() =>
      expandTargets({
        target: ["services"],
        targets: [{ manager: "go", mode: "precise" }],
      }),
    ).toThrow("Unknown target manager(s): services");
  });

  test("rejects target selection without named configuration targets", () => {
    expect(() =>
      expandTargets({
        target: ["services"],
        language: "go",
        mode: "precise",
      }),
    ).toThrow("Unknown target manager(s): services");
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

    expect(targets.map(({ files }) => files)).toEqual([
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

    expect(targets).toEqual([
      expect.objectContaining({
        packageManager: "go",
        rootDir: "/repo",
        ignore: ["**/generated/**"],
      }),
      expect.objectContaining({
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

    expect(targets.map(({ lockfile }) => lockfile)).toEqual([true, false]);
  });
});
