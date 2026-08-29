import {
  CLI_LEGEND_ITEMS,
  CLI_LEGEND_TITLE,
  CLI_STYLEGUIDE_DIFFS,
  CLI_STYLEGUIDE_GLIMMER_FRAME,
  CLI_STYLEGUIDE_LOADER_TITLE,
  CLI_STYLEGUIDE_STATUS_LINES,
  CLI_STYLEGUIDE_TITLE,
  DIFF_BACKGROUND_PALETTE,
  DIFF_FOREGROUND_PALETTE,
} from "./constants";
import {
  bold,
  createTable,
  cyan,
  error,
  formatVersionTable,
  formatVersionTableTitle,
  glimmer,
  gradient,
  gray,
  readableForeground,
  shortStatus,
  success,
} from "./utils";
import type { TableColumn, TableRow, TableRowStyle } from "./types";

const styleguideHeader = (): string => {
  return [
    gradient("codependence"),
    glimmer("codependence", { frameIndex: CLI_STYLEGUIDE_GLIMMER_FRAME }),
    bold(cyan(CLI_STYLEGUIDE_TITLE)),
  ].join("\n");
};

const styleguideStatuses = (): string => {
  const { pinned, failed, muted } = CLI_STYLEGUIDE_STATUS_LINES;
  return [shortStatus(success(), pinned), shortStatus(error(), failed), gray(muted)].join("\n");
};

export const formatCliLoader = (frameIndex = 0): string => {
  const text = `🤼‍♀️ ${glimmer("codependence", { frameIndex })} wrestling...`;
  return [bold(cyan(CLI_STYLEGUIDE_LOADER_TITLE)), text].join("\n");
};

const legendColumns = (): TableColumn[] => [
  { header: "Risk", width: 8 },
  { header: "Meaning", width: 20 },
  { header: "Example", width: 22 },
];

const legendRows = (): TableRow[] =>
  CLI_LEGEND_ITEMS.map(({ label, meaning, example }) => ({
    Risk: label,
    Meaning: meaning,
    Example: example,
  }));

const legendStyles = (): TableRowStyle[] =>
  CLI_LEGEND_ITEMS.map(({ risk }) => ({
    Example: {
      background: DIFF_BACKGROUND_PALETTE[risk][1],
      foreground: readableForeground(DIFF_FOREGROUND_PALETTE[risk][1]),
      bold: true,
    },
  }));

export const formatCliLegend = (): string => {
  return [bold(cyan(CLI_LEGEND_TITLE)), createTable(legendColumns(), legendRows(), legendStyles())].join(
    "\n",
  );
};

const styleguideTables = (): string => {
  return [
    formatVersionTableTitle(CLI_STYLEGUIDE_DIFFS, "check"),
    formatVersionTable(CLI_STYLEGUIDE_DIFFS, "check"),
    "",
    formatVersionTableTitle(CLI_STYLEGUIDE_DIFFS, "update"),
    formatVersionTable(CLI_STYLEGUIDE_DIFFS, "update"),
  ].join("\n");
};

export const formatCliStyleguide = (): string => {
  return [
    styleguideHeader(),
    styleguideStatuses(),
    formatCliLegend(),
    styleguideTables(),
    formatCliLoader(),
  ].join("\n\n");
};
