import type { ExecFileFn, ExecResult } from "../utils/types";
import { BINARY_SCRIPT_NAME, SCRIPT_PATH_EXTENSIONS } from "./constants";
import type {
  BinaryArgv,
  BinaryHost,
  BinaryHostExec,
  BinaryHostExecSync,
  BinaryHostQuestion,
  BinaryHostRestore,
  BinaryHostResult,
} from "./types";

let binaryHost: BinaryHost | undefined;

const parseHostResult = (result: string): ExecResult => {
  const parsed = JSON.parse(result) as BinaryHostResult;
  if (parsed.error) throw new Error(parsed.error);

  return { stdout: parsed.stdout || "", stderr: parsed.stderr || "" };
};

export const configureBinaryHost = (
  exec: BinaryHostExec,
  execSync: BinaryHostExecSync,
  question: BinaryHostQuestion,
): BinaryHostRestore => {
  const previousHost = binaryHost;
  binaryHost = { exec, execSync, question };

  return () => {
    binaryHost = previousHost;
  };
};

export const hasBinaryHost = (): boolean => binaryHost !== undefined;

export const binaryExecFile = (): ExecFileFn | undefined => {
  if (!binaryHost) return undefined;
  const host = binaryHost;

  return async (command, args, options) => {
    const result = await host.exec(command, args, options.cwd || "");

    return parseHostResult(result);
  };
};

export const runBinaryExecFileSync = (command: string, args: string[], cwd: string): boolean => {
  if (!binaryHost) return false;

  parseHostResult(binaryHost.execSync(command, args, cwd));
  return true;
};

export const askBinaryHost = (message: string): Promise<string> | undefined =>
  binaryHost?.question(message);

const hasPathSegment = (value: string): boolean => value.includes("/") || value.includes("\\");

const hasScriptExtension = (value: string): boolean =>
  SCRIPT_PATH_EXTENSIONS.some((extension) => value.endsWith(extension));

const isScriptPathArg = (value: string | undefined): boolean => {
  if (!value) return false;

  return hasPathSegment(value) || hasScriptExtension(value);
};

export const normalizeBinaryArgv = (argv: BinaryArgv): string[] => {
  const firstArg = argv[0] || BINARY_SCRIPT_NAME;
  const secondArg = argv[1];
  const hasDuplicateExecutable = secondArg === firstArg;

  if (hasDuplicateExecutable) {
    return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(2)];
  }

  const needsScriptArg = secondArg === undefined || !isScriptPathArg(secondArg);
  if (needsScriptArg) return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(1)];

  return [...argv];
};
