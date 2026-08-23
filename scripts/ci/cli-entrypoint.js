import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message;
}

export function isDirectCliExecution(metaUrl, argv = process.argv) {
  const scriptPath = argv[1];
  const hasScriptPath = scriptPath !== undefined;
  if (!hasScriptPath) return false;
  const resolvedUrl = pathToFileURL(resolve(scriptPath)).href;
  return metaUrl === resolvedUrl;
}

export function runCliEntrypoint(run, { processRef = process, writeError = console.error } = {}) {
  try {
    processRef.exitCode = run() ?? 0;
  } catch (error) {
    writeError(errorMessage(error));
    processRef.exitCode = 1;
  }
}
