import type { DependencyManager } from "../types";

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

export type WorkflowArea = "node" | "python" | "go" | "rust" | "infrastructure";

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
