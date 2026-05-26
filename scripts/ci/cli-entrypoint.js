export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function runCliEntrypoint(run, { processRef = process, writeError = console.error } = {}) {
  try {
    processRef.exitCode = run() ?? 0;
  } catch (error) {
    writeError(errorMessage(error));
    processRef.exitCode = 1;
  }
}
