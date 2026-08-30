export interface SpinnerState {
  text: string;
  interactive: boolean;
  isSpinning: boolean;
  frameIndex: number;
  interval: NodeJS.Timeout | null;
}

export interface SpinnerOptions {
  interactive?: boolean;
}

export interface GlimmerOptions {
  frameIndex?: number;
  highlightWidth?: number;
}

export interface GlimmerCharacterContext {
  characters: string[];
  frameIndex: number;
  highlightWidth: number;
}

export interface Spinner {
  text: string;
  start: () => Spinner;
  stop: () => Spinner;
  succeed: (text?: string) => Spinner;
  fail: (text?: string) => Spinner;
  info: (text?: string) => Spinner;
  warn: (text?: string) => Spinner;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface TableRow {
  [key: string]: string;
}

export interface TableCellStyle {
  background?: Rgb;
  foreground?: Rgb;
  bold?: boolean;
}

export type TableRowStyle = Record<string, TableCellStyle>;

export interface TableVersionDiff {
  package: string;
  current: string;
  latest: string;
  installed?: string;
  isPinned: boolean;
}

export type VersionTableMode = "check" | "update";
export type DiffSize = "major" | "minor" | "patch" | "unknown";
export type Rgb = [number, number, number];
export type SemverDiffType =
  | "major"
  | "minor"
  | "patch"
  | "premajor"
  | "preminor"
  | "prepatch"
  | "prerelease";

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export interface OrderedSemverVersions {
  lowVersion: SemverParts;
  highVersion: SemverParts;
}

export interface CliLegendItem {
  risk: DiffSize;
  label: string;
  meaning: string;
  example: string;
}

export type DiffDistance = { size: DiffSize; distance: number };
export type DiffMeasurement = DiffDistance & { score: number };
export type DiffPalette = Record<DiffSize, [Rgb, Rgb]>;
export type DiffWeights = Record<DiffSize, number>;
export type SemverDiffSizeMap = Record<SemverDiffType, DiffSize>;
