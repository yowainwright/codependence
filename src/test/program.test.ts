import { promisify } from "util";
import { exec } from "child_process";
import { expect, test } from "vitest";
import { stdoutToJSON } from "stdouttojson";

export const execPromise = promisify(exec);

/**
 * @notes all tests are based on running from root 👌
 */

test("w/ no codependence reference", async () => {
  const { stdout = "{}" } = await execPromise(
    "ts-node ./src/program.ts --rootDir './src/tests/' --isTestingCLI"
  );
  const result = stdoutToJSON(stdout);
  expect(result.updatedOptions).toStrictEqual({
    isCLI: "true",
    isTestingCLI: "true",
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
    isTestingCLI: "true",
    codependencies: ["lodash", "fs-extra"],
  });
});
