import { promisify } from "util";
import { exec } from "child_process";
import { expect, test, vi } from "vitest";
import { stdoutToJSON } from "stdouttojson";
import { cosmiconfigSync } from "cosmiconfig";
import { action } from "../program";

export const execPromise = promisify(exec);

/**
 * @note all execution tests tests are based on running from root 👌
 * @todo test search, more scenerios tests
 */

test("w/ no codependence reference", async () => {
  const { stdout = "{}" } = await execPromise(
    "ts-node ./src/program.ts --rootDir './src/tests/' --isTestingCLI"
  );
  const result = stdoutToJSON(stdout);
  expect(result.updatedOptions).toStrictEqual({
    isCLI: "true",
    rootDir: "./src/tests/",
  });
});

test("w/ only options", async () => {
  const { stdout = "{}" } = await execPromise(
    "ts-node ./src/program.ts --codependencies lodash fs-extra --isTestingCLI"
  );
  const result = stdoutToJSON(stdout);
  expect(result.updatedOptions).toStrictEqual({
    isCLI: "true",
    codependencies: ["lodash", "fs-extra"],
  });
});

test.only("action => load config", async () => {
  vi.mock("cosmiconfig", () => ({
    cosmiconfigSync: vi.fn(() => ({
      load: vi.fn(() => ({
        config: { codependencies: ["lodash", "fs-extra"] },
      })),
      search: vi.fn(),
    })),
  }));
  const explorer = cosmiconfigSync("codependence");
  const result = await action({ config: "foo-bar", isTestingAction: true });

  expect(explorer.search).toBeDefined();
  expect(explorer.load).toBeDefined();
  expect(result).toStrictEqual({
    isCLI: true,
    codependencies: ["lodash", "fs-extra"],
  });
});
