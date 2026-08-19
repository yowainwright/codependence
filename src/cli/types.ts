import type { DependencyManager } from "../types";
import type { ExecResult } from "../utils/process";

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

export interface OptionDefinition {
  flags: string[];
  hasValue?: boolean;
  isArray?: boolean;
  defaultValue?: unknown;
}

export interface ParsedFlag {
  flag: string;
  value?: string;
}

export interface CollectedValue {
  value: unknown;
  consumed: number;
}

export interface ParsedArgs {
  command?: string;
  options: Record<string, unknown>;
}

export interface ArgumentState {
  options: Record<string, unknown>;
  command?: string;
}

export interface ArgumentResult extends ArgumentState {
  nextIndex: number;
}

export type WorkflowArea = "node" | "python" | "go" | "rust" | "docker" | "infrastructure";

export interface WorkflowDefinition {
  area: WorkflowArea;
  label: string;
  managers: DependencyManager[];
  schedule: string;
}

export interface InitGitHubActionsOptions {
  force?: boolean;
  postUpdateCommands?: string[];
  rootDir?: string;
  schedules?: string[];
  targets?: DependencyManager[];
  tokenSecret?: string;
  versions?: string[];
}

export interface RenderWorkflowOptions extends WorkflowDefinition {
  postUpdateCommand: string;
  tokenSecret: string;
  versions: Map<DependencyManager, string>;
}
