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
