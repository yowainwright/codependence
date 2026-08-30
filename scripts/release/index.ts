import {
  parseArgs,
  parseTagArgs,
  runBrewCli,
  runRelease,
  runReleaseTag,
  runTestPublishedReleaseCli,
  runUploadReleaseAssetsCli,
} from "./utils";

export type * from "./types";
export * from "./utils";

const commandArgs = (argv: readonly string[]): string[] => Array.from(argv).slice(1);

export const runReleaseCli = async (argv: readonly string[] = process.argv.slice(2)) => {
  const command = argv[0];

  if (command === "brew") {
    await runBrewCli({ argv: commandArgs(argv) });
    return 0;
  }

  if (command === "assets") {
    return runUploadReleaseAssetsCli({ argv: commandArgs(argv) });
  }

  if (command === "test-published") {
    return runTestPublishedReleaseCli({ argv: commandArgs(argv) });
  }

  if (command === "tag") {
    return runReleaseTag(parseTagArgs(commandArgs(argv)));
  }

  const releaseArgs = command === "release" ? commandArgs(argv) : argv;
  return runRelease(parseArgs(releaseArgs));
};

if (import.meta.main) {
  try {
    process.exitCode = await runReleaseCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
