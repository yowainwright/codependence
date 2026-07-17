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
});
