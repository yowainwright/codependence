import { radio, select } from "../dx/prompt";
import {
  bold,
  cyan,
  createSpinner,
  error,
  formatCliLegend,
  formatCliLoader,
  formatCliStyleguide,
  formatVersionTable,
  formatVersionTableTitle,
  glimmer,
  gradient,
  gray,
  green,
  red,
  shortStatus,
  success,
  yellow,
} from "../dx/output";
import { CLI_STYLEGUIDE_DIFFS, CLI_STYLEGUIDE_STATUS_LINES } from "../dx/output/constants";
import type { PromptChoice } from "../dx/types";

const CLEAR_SCREEN = "\x1b[2J\x1b[H";
const RETURN_CHOICE: PromptChoice[] = [{ name: "Back to components", value: "back" }];
const STYLEGUIDE_CHOICES: PromptChoice[] = [
  { name: "Brand and text", value: "brand" },
  { name: "Statuses and legend", value: "statuses" },
  { name: "Dependency tables", value: "tables" },
  { name: "Spinner and glimmer", value: "spinner" },
  { name: "Radio and checkbox prompts", value: "prompts" },
  { name: "Quit", value: "quit" },
];

type StyleguideSection = "brand" | "statuses" | "tables" | "spinner" | "prompts";
type StyleguideWriter = (message: string) => void;
type StyleguidePrompts = {
  radio: typeof radio;
  select: typeof select;
};

const DEFAULT_PROMPTS: StyleguidePrompts = { radio, select };
const STYLEGUIDE_SECTIONS = new Set<StyleguideSection>([
  "brand",
  "statuses",
  "tables",
  "spinner",
  "prompts",
]);

const isStyleguideSection = (value: string): value is StyleguideSection =>
  STYLEGUIDE_SECTIONS.has(value as StyleguideSection);

const writeScreen = (write: StyleguideWriter, title: string, content: string): void => {
  process.stdout.write(CLEAR_SCREEN);
  write(
    [gradient("codependence"), bold(cyan(title)), "", content, "", gray("Esc to return")].join(
      "\n",
    ),
  );
};

const writeMenu = (write: StyleguideWriter): void => {
  process.stdout.write(CLEAR_SCREEN);
  write(
    [
      gradient("codependence"),
      bold(cyan("Codependence CLI Styleguide")),
      "",
      gray("Explore the components used by the CLI."),
    ].join("\n"),
  );
};

const waitForReturn = async (prompts: StyleguidePrompts): Promise<void> => {
  await prompts
    .radio({ message: "Return to the component menu", choices: RETURN_CHOICE })
    .catch(() => undefined);
};

const formatBrandDemo = (): string =>
  [
    `gradient  ${gradient("codependence")}`,
    `glimmer   ${glimmer("codependence", { frameIndex: 3 })}`,
    `bold      ${bold("important dependency")}`,
    `cyan      ${cyan("interactive selection")}`,
    `green     ${green("compatible update")}`,
    `yellow    ${yellow("review recommended")}`,
    `red       ${red("dependency mismatch")}`,
    `gray      ${gray("previous/current version")}`,
  ].join("\n");

const runBrandDemo = async (write: StyleguideWriter, prompts: StyleguidePrompts): Promise<void> => {
  writeScreen(write, "Brand and text", formatBrandDemo());
  await waitForReturn(prompts);
};

const formatStatusDemo = (): string => {
  const { pinned, failed, muted } = CLI_STYLEGUIDE_STATUS_LINES;
  return [
    shortStatus(success(), pinned),
    shortStatus(error(), failed),
    shortStatus(yellow(), "warning needs review"),
    gray(muted),
    "",
    formatCliLegend(),
  ].join("\n");
};

const runStatusDemo = async (
  write: StyleguideWriter,
  prompts: StyleguidePrompts,
): Promise<void> => {
  writeScreen(write, "Statuses and legend", formatStatusDemo());
  await waitForReturn(prompts);
};

const formatTableDemo = (): string =>
  [
    formatVersionTableTitle(CLI_STYLEGUIDE_DIFFS, "check"),
    formatVersionTable(CLI_STYLEGUIDE_DIFFS, "check"),
    "",
    formatVersionTableTitle(CLI_STYLEGUIDE_DIFFS, "update"),
    formatVersionTable(CLI_STYLEGUIDE_DIFFS, "update"),
  ].join("\n");

const runTableDemo = async (write: StyleguideWriter, prompts: StyleguidePrompts): Promise<void> => {
  writeScreen(write, "Dependency tables", formatTableDemo());
  await waitForReturn(prompts);
};

const delay = (duration: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, duration));

const runSpinnerDemo = async (
  write: StyleguideWriter,
  prompts: StyleguidePrompts,
): Promise<void> => {
  writeScreen(
    write,
    "Spinner and glimmer",
    `${formatCliLoader(2)}\n\nThe spinner will run briefly, then settle on a success state.`,
  );
  const spinner = createSpinner("codependence is wrestling...", { interactive: true }).start();
  await delay(640);
  spinner.succeed("codependence finished wrestling");
  await waitForReturn(prompts);
};

const promptChoices: PromptChoice[] = [
  { name: "alpha package", value: "alpha", description: "compatible patch update", checked: true },
  { name: "beta package", value: "beta", description: "minor update available" },
  { name: "gamma package", value: "gamma", description: "major update available" },
  { name: "delta package", value: "delta", description: "pinned dependency", disabled: "pinned" },
  { name: "epsilon package", value: "epsilon", description: "non-semver source" },
  { name: "zeta package", value: "zeta", description: "workspace dependency" },
  { name: "eta package", value: "eta", description: "security update" },
  { name: "theta package", value: "theta", description: "compatible patch update" },
  { name: "iota package", value: "iota", description: "minor update available" },
  { name: "kappa package", value: "kappa", description: "major update available" },
];

const runPromptDemo = async (
  write: StyleguideWriter,
  prompts: StyleguidePrompts,
): Promise<void> => {
  writeScreen(
    write,
    "Radio and checkbox prompts",
    "First, choose one package with the radio prompt.",
  );
  const radioValue = await prompts
    .radio({
      message: "Choose one package",
      choices: promptChoices,
    })
    .catch(() => undefined);

  if (!radioValue) return;

  writeScreen(
    write,
    "Radio and checkbox prompts",
    `Radio returned: ${radioValue}\n\nNow choose multiple packages. Try Space, a, n, and scrolling.`,
  );
  const selected = await prompts
    .select({
      message: "Choose packages",
      choices: promptChoices,
    })
    .catch(() => undefined);
  if (!selected) return;

  const summary = selected.length > 0 ? selected.join(", ") : "none";
  writeScreen(write, "Radio and checkbox prompts", `Checkbox returned: ${summary}`);
  await waitForReturn(prompts);
};

const runStyleguideDemo = (
  section: StyleguideSection,
  write: StyleguideWriter,
  prompts: StyleguidePrompts,
): Promise<void> => {
  if (section === "brand") return runBrandDemo(write, prompts);
  if (section === "statuses") return runStatusDemo(write, prompts);
  if (section === "tables") return runTableDemo(write, prompts);
  if (section === "spinner") return runSpinnerDemo(write, prompts);
  return runPromptDemo(write, prompts);
};

const isCiOutput = (): boolean => Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

const isInteractiveStyleguide = (): boolean => {
  if (isCiOutput()) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
};

export const runCliStyleguide = async (
  write: StyleguideWriter = (message) => process.stdout.write(`${message}\n`),
  prompts: StyleguidePrompts = DEFAULT_PROMPTS,
): Promise<void> => {
  if (!isInteractiveStyleguide()) {
    write(formatCliStyleguide());
    return;
  }

  while (true) {
    writeMenu(write);
    const selected = await prompts
      .radio({
        message: "Choose a component",
        choices: STYLEGUIDE_CHOICES,
      })
      .catch(() => "quit");
    const isQuit = selected === "quit";
    const isUnknownSection = !isStyleguideSection(selected);
    if (isQuit) return;
    if (isUnknownSection) return;
    await runStyleguideDemo(selected, write, prompts);
  }
};
