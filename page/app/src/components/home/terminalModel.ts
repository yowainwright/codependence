export type AnsiColor = "cyan" | "gray" | "green" | "red" | "yellow";

export type TerminalSegment = {
  text: string;
  className?: string;
  ansiColor?: AnsiColor;
};

export type TerminalLine = TerminalSegment[];

export type SegmentEntry = [
  text: string,
  className?: string,
  ansiColor?: AnsiColor,
];

export type MaintenanceMode = "check" | "dry-run" | "update";

export type LanguageId = "nodejs" | "python" | "go";

export type VersionRow = {
  packageName: string;
  current: string;
  latest: string;
  isPinned?: boolean;
};

export type TerminalTab = {
  id: string;
  title: string;
};

export type SpotlightSnippetId = MaintenanceMode;

export type SpotlightSnippet = {
  id: SpotlightSnippetId;
  title: string;
  lines: TerminalLine[];
};

export type LanguageDemo = {
  id: LanguageId;
  title: string;
  language: LanguageId;
  issueSummary: string;
  issues: string[];
  rows: VersionRow[];
};

export const ANSI_CLASS_NAMES: Record<AnsiColor | "boldCyan" | "base", string> =
  {
    base: "text-base-content",
    boldCyan: "font-semibold text-cyan-400",
    cyan: "text-cyan-400",
    gray: "text-base-content/50",
    green: "text-success",
    red: "text-error",
    yellow: "text-warning",
  };

export const TERMINAL_FRAME_MAX_WIDTH_CLASS = "max-w-[46rem]";
export const TERMINAL_FRAME_CLASS = `spotlight-frame w-full min-w-0 ${TERMINAL_FRAME_MAX_WIDTH_CLASS}`;
export const SPOTLIGHT_TERMINAL_CONTENT_CLASS = "h-[420px]";
export const LANGUAGE_TERMINAL_CONTENT_CLASS = "h-[390px]";
export const TERMINAL_TARGET_COLUMNS = 80;

export const CODEPENDENCE_COMMAND = "codependence";
export const SPOTLIGHT_TAB_DELAY_MS = 4600;

export const maintenanceModes: Array<{ id: MaintenanceMode; title: string }> = [
  { id: "check", title: "Check" },
  { id: "dry-run", title: "Dry Run" },
  { id: "update", title: "Update" },
];

export const languages: LanguageDemo[] = [
  {
    id: "nodejs",
    title: "Node.js package.json",
    language: "nodejs",
    issueSummary: "Found 2 dependency issues",
    issues: [
      "    1. lodash: found 4.17.0, expected 4.17.21",
      "    2. fs-extra: found 10.0.0, expected 10.1.0",
    ],
    rows: [
      {
        packageName: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        isPinned: true,
      },
      {
        packageName: "fs-extra",
        current: "10.0.0",
        latest: "10.1.0",
        isPinned: true,
      },
    ],
  },
  {
    id: "python",
    title: "Python requirements.txt",
    language: "python",
    issueSummary: "Found 2 dependency issues",
    issues: [
      "    1. requests: found ==2.28.0, expected ==2.31.0",
      "    2. flask: found ==2.0.0, expected ==2.3.3",
    ],
    rows: [
      {
        packageName: "requests",
        current: "==2.28.0",
        latest: "==2.31.0",
        isPinned: true,
      },
      {
        packageName: "flask",
        current: "==2.0.0",
        latest: "==2.3.3",
        isPinned: true,
      },
    ],
  },
  {
    id: "go",
    title: "Go go.mod",
    language: "go",
    issueSummary: "Found 2 dependency issues",
    issues: [
      "    1. github.com/lib/pq: found v1.10.0, expected v1.10.9",
      "    2. golang.org/x/crypto: found v0.10.0, expected v0.11.0",
    ],
    rows: [
      {
        packageName: "github.com/lib/pq",
        current: "v1.10.0",
        latest: "v1.10.9",
        isPinned: true,
      },
      {
        packageName: "golang.org/x/crypto",
        current: "v0.10.0",
        latest: "v0.11.0",
        isPinned: true,
      },
    ],
  },
];

export const DRIFT_TABLE_LINES: TerminalLine[] = createVersionTable(
  languages[0].rows,
);

export const spotlightSnippets: SpotlightSnippet[] = maintenanceModes.map(
  (mode) => ({
    ...mode,
    lines: createSpotlightTranscript(mode.id),
  }),
);

export function getSpotlightSnippet(id: SpotlightSnippetId): SpotlightSnippet {
  return (
    spotlightSnippets.find((snippet) => snippet.id === id) ??
    spotlightSnippets[0]
  );
}

export function createSpotlightTranscript(
  mode: MaintenanceMode,
): TerminalLine[] {
  const language = languages[0];
  const command =
    mode === "check"
      ? CODEPENDENCE_COMMAND
      : `${CODEPENDENCE_COMMAND} --update${mode === "dry-run" ? " --dryRun" : ""}`;

  if (mode === "check") {
    return [
      shell(command),
      blank(),
      ...createIssueLines(language),
      ...errorLines(),
    ];
  }

  if (mode === "dry-run") {
    return [
      shell(command),
      blank(),
      cliBanner("Dry run - no files will be modified"),
      blank(),
      cliHeader("Dependencies that would be updated:"),
      ...DRIFT_TABLE_LINES,
      blank(),
      ...createIssueLines(language),
      ...errorLines(),
    ];
  }

  return [
    shell(command),
    blank(),
    cliHeader("Dependency Updates Available:"),
    ...DRIFT_TABLE_LINES,
    blank(),
    ...createIssueLines(language),
    loggerPrefix(),
    loggerInfo(
      "Dependencies were not correct but should be updated! Check your git status.",
    ),
    spinnerSuccess("pinned"),
  ];
}

export function createLanguageTranscript(
  language: LanguageDemo,
  mode: MaintenanceMode,
): TerminalLine[] {
  const command = createCommand(language.language, mode);
  const issueLines = createIssueLines(language);

  if (mode === "check") {
    return [shell(command), blank(), ...issueLines, ...errorLines()];
  }

  if (mode === "dry-run") {
    return [
      shell(command),
      blank(),
      cliBanner("Dry run - no files will be modified"),
      blank(),
      cliHeader("Dependencies that would be updated:"),
      ...createVersionTable(language.rows),
      blank(),
      ...issueLines,
      ...errorLines(),
    ];
  }

  return [
    shell(command),
    blank(),
    cliHeader("Dependency Updates Available:"),
    ...createVersionTable(language.rows),
    blank(),
    ...issueLines,
    loggerPrefix(),
    loggerInfo(
      "Dependencies were not correct but should be updated! Check your git status.",
    ),
    spinnerSuccess("pinned"),
  ];
}

export function createCommand(language: LanguageId, mode: MaintenanceMode) {
  const base = `${CODEPENDENCE_COMMAND} --language ${language}`;

  if (mode === "dry-run") return `${base} --update --dryRun`;
  if (mode === "update") return `${base} --update`;

  return base;
}

export function createIssueLines(
  language: Pick<LanguageDemo, "issueSummary" | "issues">,
): TerminalLine[] {
  return [
    loggerPrefix(),
    loggerInfo(language.issueSummary),
    ...language.issues.map((issue) => plain(issue)),
    blank(),
  ];
}

export function errorLines(): TerminalLine[] {
  return [
    loggerPrefix("error"),
    loggerError("Dependencies are not correct."),
    plain("Error: Dependencies are not correct."),
  ];
}

export function shell(command: string): TerminalLine {
  return segments([["$", ANSI_CLASS_NAMES.gray, "gray"], [" "], [command]]);
}

export function cliBanner(text: string): TerminalLine {
  return plain(`◆ ${text}`, ANSI_CLASS_NAMES.cyan, "cyan");
}

export function cliHeader(text: string): TerminalLine {
  return segments([["◆", ANSI_CLASS_NAMES.cyan, "cyan"], [` ${text}`]]);
}

export function spinnerSuccess(
  text: "dry run complete" | "pinned",
): TerminalLine {
  return segments([
    ["✔", ANSI_CLASS_NAMES.green, "green"],
    [" 🤼‍♀️ "],
    ["codependence", ANSI_CLASS_NAMES.boldCyan, "cyan"],
    [` ${text}!`],
  ]);
}

export function loggerPrefix(level: "info" | "error" = "info"): TerminalLine {
  return [
    {
      text: CODEPENDENCE_COMMAND,
      className:
        level === "error" ? ANSI_CLASS_NAMES.red : ANSI_CLASS_NAMES.boldCyan,
      ansiColor: level === "error" ? "red" : "cyan",
    },
  ];
}

export function loggerInfo(message: string): TerminalLine {
  return plain(`  🤼‍♀️  ${message}`);
}

export function loggerError(message: string): TerminalLine {
  return segments([
    ["  "],
    ["✗", ANSI_CLASS_NAMES.red, "red"],
    ["  "],
    [message],
  ]);
}

export function createVersionTable(rows: VersionRow[]): TerminalLine[] {
  return [
    plain(
      "┌──────────────────────┬──────────────┬──────────────┬──────────────┐",
    ),
    segments([
      ["│ "],
      [padCell("Package", 20), ANSI_CLASS_NAMES.cyan, "cyan"],
      [" │ "],
      [padCell("Current", 12), ANSI_CLASS_NAMES.cyan, "cyan"],
      [" │ "],
      [padCell("Latest", 12), ANSI_CLASS_NAMES.cyan, "cyan"],
      [" │ "],
      [padCell("Action", 12), ANSI_CLASS_NAMES.cyan, "cyan"],
      [" │"],
    ]),
    plain(
      "├──────────────────────┼──────────────┼──────────────┼──────────────┤",
    ),
    ...rows.map(tableRow),
    plain(
      "└──────────────────────┴──────────────┴──────────────┴──────────────┘",
    ),
  ];
}

export function blank(): TerminalLine {
  return [{ text: "" }];
}

export function plain(
  text: string,
  className?: string,
  ansiColor?: AnsiColor,
): TerminalLine {
  return [
    {
      text,
      ...(className ? { className } : {}),
      ...(ansiColor ? { ansiColor } : {}),
    },
  ];
}

export function segments(entries: SegmentEntry[]): TerminalLine {
  return entries.map(([text, className, ansiColor]) => ({
    text,
    ...(className ? { className } : {}),
    ...(ansiColor ? { ansiColor } : {}),
  }));
}

export function flattenTerminalLine(line: TerminalLine): string {
  return line.map((segment) => segment.text).join("");
}

export function flattenTerminalLines(lines: TerminalLine[]): string[] {
  return lines.map(flattenTerminalLine);
}

function tableRow(row: VersionRow): TerminalLine {
  return segments([
    ["│ "],
    [padCell(row.packageName, 20)],
    [" │ "],
    [padCell(row.current, 12), ANSI_CLASS_NAMES.gray, "gray"],
    [" │ "],
    [padCell(row.latest, 12)],
    [" │ "],
    [
      padCell(row.isPinned === false ? "Update ✓" : "Pinned ■", 12),
      row.isPinned === false ? ANSI_CLASS_NAMES.green : ANSI_CLASS_NAMES.yellow,
      row.isPinned === false ? "green" : "yellow",
    ],
    [" │"],
  ]);
}

function padCell(text: string, width: number) {
  return `${text}${" ".repeat(Math.max(0, width - text.length))}`;
}
