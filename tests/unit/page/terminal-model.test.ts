import { readFileSync } from "fs";
import { describe, expect, test } from "bun:test";
import {
  ANSI_CLASS_NAMES,
  LANGUAGE_TERMINAL_CONTENT_CLASS,
  SPOTLIGHT_TERMINAL_CONTENT_CLASS,
  TERMINAL_FRAME_MAX_WIDTH_CLASS,
  TERMINAL_TARGET_COLUMNS,
  createLanguageTranscript,
  createSpotlightTranscript,
  createVersionTable,
  flattenTerminalLines,
  languages,
} from "../../../page/app/src/components/home/terminalModel";
import { createAnsiPattern } from "../../../src/utils/constants";
import { formatVersionTable } from "../../../src/utils/table";

const stripAnsi = (value: string) => value.replace(createAnsiPattern(), "");

describe("docs terminal model", () => {
  test("renders the same table text as the CLI version table helper", () => {
    const rows = languages[0].rows;
    const siteTable = flattenTerminalLines(createVersionTable(rows)).join("\n");
    const cliTable = stripAnsi(
      formatVersionTable(
        rows.map((row) => ({
          package: row.packageName,
          current: row.current,
          latest: row.latest,
          isPinned: row.isPinned ?? true,
        })),
      ),
    );

    expect(siteTable).toBe(cliTable);
  });

  test("maps transcript segments to the CLI ANSI color families", () => {
    const table = createVersionTable(languages[0].rows);
    const header = table[1];
    const firstRow = table[3];

    expect(
      header.filter((segment) => segment.ansiColor === "cyan"),
    ).toHaveLength(4);
    expect(
      firstRow.some(
        (segment) =>
          segment.text.includes("4.17.0") && segment.ansiColor === "gray",
      ),
    ).toBe(true);
    expect(
      firstRow.some(
        (segment) =>
          segment.text.includes("Pinned") && segment.ansiColor === "yellow",
      ),
    ).toBe(true);

    const errorTranscript = createSpotlightTranscript("check");
    expect(
      errorTranscript.some((line) =>
        line.some(
          (segment) =>
            segment.text === "codependence" &&
            segment.className === ANSI_CLASS_NAMES.red &&
            segment.ansiColor === "red",
        ),
      ),
    ).toBe(true);
  });

  test("spotlight transcripts match observed CLI message flow", () => {
    const check = flattenTerminalLines(createSpotlightTranscript("check"));
    const dryRun = flattenTerminalLines(createSpotlightTranscript("dry-run"));
    const update = flattenTerminalLines(createSpotlightTranscript("update"));

    expect(check[0]).toBe("$ codependence");
    expect(check).toContain("Error: Dependencies are not correct.");
    expect(
      check.some((line) => line.includes("Dependencies that would be updated")),
    ).toBe(false);

    expect(dryRun[0]).toBe("$ codependence --update --dryRun");
    expect(dryRun).toContain("◆ Dry run - no files will be modified");
    expect(dryRun).toContain("◆ Dependencies that would be updated:");
    expect(dryRun).toContain("Error: Dependencies are not correct.");

    expect(update[0]).toBe("$ codependence --update");
    expect(update).toContain("◆ Dependency Updates Available:");
    expect(update).toContain("✔ 🤼‍♀️ codependence pinned!");

    expect(
      [...check, ...dryRun, ...update].some((line) =>
        line.includes("wrestling"),
      ),
    ).toBe(false);
  });

  test("language transcripts cover every provider and maintenance mode", () => {
    for (const language of languages) {
      expect(
        flattenTerminalLines(createLanguageTranscript(language, "check"))[0],
      ).toBe(`$ codependence --language ${language.language}`);
      expect(
        flattenTerminalLines(createLanguageTranscript(language, "dry-run"))[0],
      ).toBe(
        `$ codependence --language ${language.language} --update --dryRun`,
      );
      expect(
        flattenTerminalLines(createLanguageTranscript(language, "update"))[0],
      ).toBe(`$ codependence --language ${language.language} --update`);
    }
  });

  test("terminal sizing and overflow contracts stay stable", () => {
    expect(TERMINAL_FRAME_MAX_WIDTH_CLASS).toBe("max-w-[46rem]");
    expect(SPOTLIGHT_TERMINAL_CONTENT_CLASS).toBe("h-[420px]");
    expect(LANGUAGE_TERMINAL_CONTENT_CLASS).toBe("h-[390px]");
    expect(TERMINAL_TARGET_COLUMNS).toBe(80);

    const css = readFileSync("page/app/src/styles/global.css", "utf8");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("width: max-content;");
    expect(css).toContain("white-space: pre;");
  });
});
