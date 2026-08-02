import type { ExecFileFn, ExecResult } from "../utils/types";

export type BinaryHostExec = (command: string, args: string[], cwd: string) => Promise<string>;
export type BinaryHostExecSync = (command: string, args: string[], cwd: string) => string;
export type BinaryHostQuestion = (message: string) => Promise<string>;

interface BinaryHost {
  exec: BinaryHostExec;
  execSync: BinaryHostExecSync;
  question: BinaryHostQuestion;
}

interface BinaryHostResult extends ExecResult {
  error?: string;
}

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
): void => {
  binaryHost = { exec, execSync, question };
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

export { runBinary } from "./utils";
