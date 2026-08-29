import type {
  CliLegendItem,
  DiffPalette,
  DiffSize,
  DiffWeights,
  Rgb,
  SemverDiffSizeMap,
  TableColumn,
  TableVersionDiff,
  VersionTableMode,
} from "./types";

export const SPINNER_FRAMES = [
  "\u280b",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283c",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280f",
];
export const SPINNER_INTERVAL_MS = 80;
export const LINE_BREAKS = /[\r\n]+/g;
export const GLIMMER_HIGHLIGHT_COLOR: Rgb = [255, 255, 255];
export const GLIMMER_HIGHLIGHT_WIDTH = 2;
export const CLI_STYLEGUIDE_GLIMMER_FRAME = 5;
export const CLI_STYLEGUIDE_LOADER_INTERVAL_MS = 80;
export const CLI_STYLEGUIDE_LOADER_TITLE = "Loader";
export const TABLE_CELL_PADDING = 2;
export const MIN_DIFF_INTENSITY = 0.38;
export const MAX_DIFF_INTENSITY = 1;
export const DIFF_DISTANCE_WEIGHT = 0.99;
export const UNKNOWN_DIFF_DISTANCE = 1;
export const TABLE_TARGET_FOREGROUND_MIX = 0.58;
export const CODEPENDENCE_GRADIENT_START: Rgb = [0, 194, 255];
export const CODEPENDENCE_GRADIENT_QUARTER: Rgb = [47, 169, 255];
export const CODEPENDENCE_GRADIENT_MIDDLE: Rgb = [94, 143, 255];
export const CODEPENDENCE_GRADIENT_THREE_QUARTER: Rgb = [141, 118, 255];
export const CODEPENDENCE_GRADIENT_END: Rgb = [188, 92, 255];
export const TABLE_TARGET_FOREGROUND_BASE: Rgb = [255, 255, 255];
export const SHORT_STATUS_FOREGROUND: Rgb = [255, 248, 176];
export const MUTED_VERSION_COLOR: Rgb = [214, 220, 232];
export const VERSION_TABLE_TITLES: Record<VersionTableMode, string> = {
  check: "Dependency Updates Available",
  update: "Updated Dependencies",
};
export const VERSION_TABLE_COLUMNS: Record<VersionTableMode, TableColumn[]> = {
  check: [
    { header: "Package", width: 20, align: "left" },
    { header: "Current", width: 12, align: "left" },
    { header: "Available", width: 12, align: "left" },
  ],
  update: [
    { header: "Package", width: 20, align: "left" },
    { header: "Previous", width: 12, align: "left" },
    { header: "Updated", width: 12, align: "left" },
  ],
};
export const CLI_STYLEGUIDE_TITLE = "Codependence CLI Styleguide";
export const CLI_LEGEND_TITLE = "Dependency Risk Legend";
export const CLI_STYLEGUIDE_STATUS_LINES = {
  pinned: "pinned!",
  failed: "dependencies are not correct",
  muted: "previous/current dependency versions",
};
export const CLI_LEGEND_ITEMS: CliLegendItem[] = [
  {
    risk: "patch",
    label: "Patch",
    meaning: "compatible fix",
    example: "1.2.3 -> 1.2.4",
  },
  {
    risk: "minor",
    label: "Minor",
    meaning: "compatible feature",
    example: "1.2.3 -> 1.3.0",
  },
  {
    risk: "major",
    label: "Major",
    meaning: "breaking change",
    example: "1.2.3 -> 2.0.0",
  },
  {
    risk: "unknown",
    label: "Unknown",
    meaning: "non-semver source",
    example: "link:../pkg -> 1.0.0",
  },
];
export const CLI_STYLEGUIDE_DIFFS: TableVersionDiff[] = [
  {
    package: "patch-small",
    current: "1.2.3",
    latest: "1.2.4",
    installed: "1.2.4",
    isPinned: false,
  },
  {
    package: "patch-large",
    current: "1.2.3",
    latest: "1.2.80",
    installed: "1.2.80",
    isPinned: false,
  },
  {
    package: "minor-small",
    current: "1.2.3",
    latest: "1.3.0",
    installed: "1.3.0",
    isPinned: false,
  },
  {
    package: "minor-large",
    current: "1.2.3",
    latest: "1.12.0",
    installed: "1.12.0",
    isPinned: false,
  },
  {
    package: "major-small",
    current: "1.2.3",
    latest: "2.0.0",
    installed: "2.0.0",
    isPinned: false,
  },
  {
    package: "major-large",
    current: "1.2.3",
    latest: "8.0.0",
    installed: "8.0.0",
    isPinned: false,
  },
  {
    package: "@scope/really-long-dependency-package-name",
    current: "link:../../oss/codependence",
    latest: "1.0.15",
    installed: "1.0.15",
    isPinned: true,
  },
];
export const DIFF_WEIGHTS: DiffWeights = {
  unknown: 0,
  patch: 10,
  minor: 20,
  major: 30,
};
export const SEMVER_DIFF_SIZE: SemverDiffSizeMap = {
  major: "major",
  premajor: "major",
  minor: "minor",
  preminor: "minor",
  patch: "patch",
  prepatch: "patch",
  prerelease: "patch",
};
export const DIFF_RANGE_LIMITS: Record<DiffSize, number> = {
  major: 5,
  minor: 12,
  patch: 50,
  unknown: UNKNOWN_DIFF_DISTANCE,
};
export const PATCH_DIFF_FOREGROUND: [Rgb, Rgb] = [
  CODEPENDENCE_GRADIENT_START,
  CODEPENDENCE_GRADIENT_QUARTER,
];
export const MINOR_DIFF_FOREGROUND: [Rgb, Rgb] = [
  CODEPENDENCE_GRADIENT_MIDDLE,
  CODEPENDENCE_GRADIENT_THREE_QUARTER,
];
export const MAJOR_DIFF_FOREGROUND: [Rgb, Rgb] = [
  CODEPENDENCE_GRADIENT_THREE_QUARTER,
  CODEPENDENCE_GRADIENT_END,
];
export const UNKNOWN_DIFF_FOREGROUND: [Rgb, Rgb] = [
  CODEPENDENCE_GRADIENT_MIDDLE,
  CODEPENDENCE_GRADIENT_MIDDLE,
];
export const PATCH_DIFF_BACKGROUND: [Rgb, Rgb] = [
  [0, 35, 46],
  [15, 54, 82],
];
export const MINOR_DIFF_BACKGROUND: [Rgb, Rgb] = [
  [24, 37, 76],
  [45, 43, 97],
];
export const MAJOR_DIFF_BACKGROUND: [Rgb, Rgb] = [
  [53, 36, 92],
  [82, 40, 112],
];
export const UNKNOWN_DIFF_BACKGROUND: [Rgb, Rgb] = [
  [32, 42, 78],
  [32, 42, 78],
];
export const DIFF_FOREGROUND_PALETTE: DiffPalette = {
  major: MAJOR_DIFF_FOREGROUND,
  minor: MINOR_DIFF_FOREGROUND,
  patch: PATCH_DIFF_FOREGROUND,
  unknown: UNKNOWN_DIFF_FOREGROUND,
};
export const DIFF_BACKGROUND_PALETTE: DiffPalette = {
  major: MAJOR_DIFF_BACKGROUND,
  minor: MINOR_DIFF_BACKGROUND,
  patch: PATCH_DIFF_BACKGROUND,
  unknown: UNKNOWN_DIFF_BACKGROUND,
};
