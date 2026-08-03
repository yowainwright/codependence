import type { ExecResult } from "../utils/types";

export type BinaryArgv = readonly string[];
export type BinaryHostExec = (command: string, args: string[], cwd: string) => Promise<string>;
export type BinaryHostExecSync = (command: string, args: string[], cwd: string) => string;
export type BinaryHostQuestion = (message: string) => Promise<string>;
export type BinaryHostRestore = () => void;

export interface BinaryHost {
  exec: BinaryHostExec;
  execSync: BinaryHostExecSync;
  question: BinaryHostQuestion;
}

export interface BinaryHostResult extends ExecResult {
  error?: string;
}
