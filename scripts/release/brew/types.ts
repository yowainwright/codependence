export type Fetch = typeof fetch;

export interface FormulaSource {
  digest: string;
  url: string;
}

export interface FormulaInput extends FormulaSource {
  version: string;
}

export interface FormulaOptions {
  outputPath: string;
  version: string;
}

export interface PublishedFormulaOptions extends FormulaOptions {
  fetchImpl?: Fetch;
}

export interface LocalFormulaOptions extends FormulaOptions {
  tarballPath: string;
}

export interface BrewCliOptions {
  argv?: string[];
  env?: Record<string, string | undefined>;
}
