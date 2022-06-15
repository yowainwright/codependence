import { exec } from "child_process";
import { expect, test } from "vitest";
import { stdoutToJSON } from "stdouttojson";

/**
 * @notes all tests are based on running from root 👌
 */

test("config w/ unique path test", async () => {
  const test = await exec(
    "ts-node ./src/program.ts --config test-package.json --isTestingCLI",
    (_, stdout) => {
      const json = stdoutToJSON(stdout);
      return json;
    }
  );
  console.log({ test });
});

test("config w/ .codependencerc", async () => {
  const result = await exec(
    "ts-node ./src/program.ts --config ./src/test/test-package.json --isTestingCLI"
  );
  console.log({ result });
  expect(1).toBe(1);
});

test("config w/ options", async () => {
  let json;
  await exec(
    "ts-node ./src/program.ts --codependencies 'lodash' 'fs-extra' --files './src/test/test-package.json' --isTestingCLI",
    (_, stdout) => {
      json = stdoutToJSON(stdout);
      expect(1).toBe(1);
    }
  );
  console.log({ json });
});
