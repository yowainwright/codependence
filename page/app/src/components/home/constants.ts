import {
  Gauge,
  GitBranch,
  Package,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import type { CodeSnippet, Feature, NavigationItem } from "@/types";
import { resolveDocsUrl, resolveUrl } from "@/utils/urlResolver";

export const HERO_INSTALL_COMMAND = "npm install codependence";
export const DEV_INSTALL_COMMAND = "npm install --save-dev codependence";
export const HERO_CLIP_PATH =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 150%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)";
export const SPOTLIGHT_TYPING_SPEED = 12;
export const SPOTLIGHT_TAB_PAUSE_MS = 2500;

const POLICY_CHECKS_DESCRIPTION =
  "Compare manifests against the versions your project expects and fail when dependencies drift.";
const VERSION_CONTROL_DESCRIPTION =
  "Update only listed packages, or pin selected packages while updating everything else.";
const MONOREPO_POLICY_DESCRIPTION =
  "Use root defaults and package-specific policies to keep workspace versions intentional.";
const CLI_API_DESCRIPTION =
  "Run Codependence from the command line or integrate it into custom tooling with the Node.js API.";
const CI_GATES_DESCRIPTION =
  "Use the same checks locally and in CI so version policy is enforced before merge.";
const STRUCTURED_OUTPUT_DESCRIPTION =
  "Generate table, JSON, or Markdown reports for scripts, PR comments, and audits.";

const HOME_NAV_ITEM: NavigationItem = {
  title: "Home",
  href: resolveUrl(""),
};

const DOCS_NAV_ITEM: NavigationItem = {
  title: "Docs",
  href: resolveDocsUrl("introduction"),
};

export const NAVIGATION = [HOME_NAV_ITEM, DOCS_NAV_ITEM];

export const FEATURES: Feature[] = [
  {
    title: "Policy Checks",
    description: POLICY_CHECKS_DESCRIPTION,
    icon: Gauge,
  },
  {
    title: "Version Control",
    description: VERSION_CONTROL_DESCRIPTION,
    icon: Package,
  },
  {
    title: "Monorepo Policy",
    description: MONOREPO_POLICY_DESCRIPTION,
    icon: GitBranch,
  },
  {
    title: "CLI & API",
    description: CLI_API_DESCRIPTION,
    icon: Terminal,
  },
  {
    title: "CI Gates",
    description: CI_GATES_DESCRIPTION,
    icon: RefreshCw,
  },
  {
    title: "Structured Output",
    description: STRUCTURED_OUTPUT_DESCRIPTION,
    icon: Search,
  },
];

export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: "policy",
    title: "Policy",
    lines: [
      { text: "$ ", color: "text-secondary" },
      {
        text: "codependence --dryRun --format table",
        color: "text-base-content",
      },
      { text: "\n\n", color: "" },
      { text: "Policy: ", color: "text-base-content/70" },
      { text: ".codependencerc", color: "text-primary" },
      { text: "\nStrategy: ", color: "text-base-content/70" },
      { text: "permissive", color: "text-accent" },
      { text: " (pin listed, update the rest)", color: "text-base-content/50" },
      { text: "\nFiles: ", color: "text-base-content/70" },
      { text: "package.json packages/*/package.json", color: "text-info" },
      { text: "\n\n", color: "" },
      { text: "No files changed in dry run", color: "text-success" },
    ],
  },
  {
    id: "config",
    title: "Config",
    lines: [
      { text: "\u002f\u002f .codependencerc", color: "text-base-content/50" },
      { text: "\n", color: "" },
      { text: "{", color: "text-base-content" },
      { text: "\n  ", color: "" },
      { text: '"permissive"', color: "text-primary" },
      { text: ": ", color: "text-base-content" },
      { text: "true", color: "text-secondary" },
      { text: ",", color: "text-base-content" },
      { text: "\n  ", color: "" },
      { text: '"codependencies"', color: "text-primary" },
      { text: ": [", color: "text-base-content" },
      { text: "\n    ", color: "" },
      { text: "{ ", color: "text-base-content" },
      { text: '"react"', color: "text-primary" },
      { text: ": ", color: "text-base-content" },
      { text: '"^18.3.1"', color: "text-success" },
      { text: " },", color: "text-base-content" },
      { text: "\n    ", color: "" },
      { text: "{ ", color: "text-base-content" },
      { text: '"typescript"', color: "text-primary" },
      { text: ": ", color: "text-base-content" },
      { text: '"^5.9.3"', color: "text-success" },
      { text: " }", color: "text-base-content" },
      { text: "\n  ],", color: "text-base-content" },
      { text: "\n  ", color: "" },
      { text: '"files"', color: "text-primary" },
      {
        text: ': ["package.json", "packages/*/package.json"]',
        color: "text-base-content",
      },
      { text: "\n}", color: "text-base-content" },
    ],
  },
  {
    id: "check",
    title: "CI Check",
    lines: [
      { text: "$ ", color: "text-secondary" },
      { text: "codependence", color: "text-base-content" },
      { text: "\n\n", color: "" },
      { text: "Found 2 dependency issues", color: "text-warning" },
      { text: "\n", color: "" },
      {
        text: "1. react: found 19.0.0, expected ^18.3.1",
        color: "text-base-content",
      },
      { text: "\n", color: "" },
      {
        text: "2. typescript: found 5.7.0, expected ^5.9.3",
        color: "text-base-content",
      },
      { text: "\n", color: "" },
      { text: "\n", color: "" },
      { text: "Dependencies are not correct.", color: "text-error" },
      { text: "\n", color: "" },
      { text: "\nCI result: ", color: "text-base-content/70" },
      { text: "fail on drift", color: "text-error" },
    ],
  },
  {
    id: "apply",
    title: "Apply",
    lines: [
      { text: "$ ", color: "text-secondary" },
      { text: "codependence --update", color: "text-base-content" },
      { text: "\n\n", color: "" },
      { text: "Applying version policy...", color: "text-base-content/70" },
      { text: "\n\n", color: "" },
      { text: "react ", color: "text-base-content" },
      { text: "19.0.0", color: "text-warning" },
      { text: " -> ", color: "text-base-content/50" },
      { text: "^18.3.1", color: "text-success" },
      { text: "\n", color: "" },
      { text: "typescript ", color: "text-base-content" },
      { text: "5.7.0", color: "text-warning" },
      { text: " -> ", color: "text-base-content/50" },
      { text: "^5.9.3", color: "text-success" },
      { text: "\n", color: "" },
      { text: "\n\n", color: "" },
      { text: "Updated ", color: "text-success" },
      { text: "2", color: "text-accent" },
      { text: " dependencies in ", color: "text-base-content" },
      { text: "package.json", color: "text-info" },
    ],
  },
];
