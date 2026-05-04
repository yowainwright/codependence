export interface OptionDefinition {
  flags: string[];
  hasValue?: boolean;
  isArray?: boolean;
  defaultValue?: unknown;
  validValues?: readonly string[];
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
  positionals: string[];
  options: Record<string, unknown>;
}
