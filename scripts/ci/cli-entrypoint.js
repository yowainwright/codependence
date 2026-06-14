import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isDirectCliExecution(metaUrl, argv = process.argv) {
  const scriptPath = argv[1];
  return scriptPath !== undefined && metaUrl === pathToFileURL(resolve(scriptPath)).href;
}

export function runCliEntrypoint(run, { processRef = process, writeError = console.error } = {}) {
  try {
    processRef.exitCode = run() ?? 0;
  } catch (error) {
    writeError(errorMessage(error));
    processRef.exitCode = 1;
  }
}
