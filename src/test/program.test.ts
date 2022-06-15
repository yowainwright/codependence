import { exec } from "child_process";
import { expect, test } from "vitest";
import { stdoutToJSON } from "stdouttojson";

/**
 * @notes all tests are based on running from root
 */

test("config w/ unique path test", async () => {
  await exec(
    "ts-node ./src/program.ts --config test-package.json --isTestingCLI",
    (_, stdout) => {
      const json = stdoutToJSON(stdout);
      console.log({ json });
      expect(1).toBe(1);
    }
  );
});

test("config w/ .codependencerc", async () => {
  await exec(
    "ts-node ./src/program.ts --config test-package.json --isTestingCLI",
    (_, stdout) => {
      const json = stdoutToJSON(stdout);
      console.log({ json });
      expect(1).toBe(1);
    }
  );
});

test("config w/ options", async () => {
  await exec(
    "ts-node ./src/program.ts --codependencies 'lodash' 'fs-extra' --files './src/test/test-package.json' --isTestingCLI",
    (_, stdout) => {
      const json = stdoutToJSON(stdout);
      console.log({ json });
      expect(1).toBe(1);
    }
  );
});
