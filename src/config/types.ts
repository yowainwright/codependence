export interface ConfigResult {
  config: Record<string, unknown>;
  filepath: string;
  isEmpty?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationOptions {
  requirePolicy?: boolean;
}

export interface ParsedLine {
  indent: number;
  text: string;
}

export interface SplitState {
  items: string[];
  quote: string | null;
  braceDepth: number;
  bracketDepth: number;
  current: string;
}

export interface ParsedBlock {
  value: unknown;
  nextIndex: number;
}

export interface ParsedField {
  key: string;
  value: unknown;
  nextIndex: number;
}
