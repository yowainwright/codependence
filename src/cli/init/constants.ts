import type { OnboardingDependencySection, OnboardingManager } from "./types";
import {
  ACTION_REF,
  CHECKOUT_REF,
  DEFAULT_ACTION_SCHEDULE,
  DEFAULT_TOKEN_SECRET,
  EXACT_TOOL_VERSION_PATTERN,
} from "../constants";

export const ONBOARDING_PACKAGE_FILE = "package.json";
export const ONBOARDING_PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";

export const ONBOARDING_RECURSIVE_SOURCE_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "environment.yml",
  "environment.yaml",
  "go.mod",
  "Cargo.toml",
  "uv.lock",
];

const ONBOARDING_RECURSIVE_PATTERNS = ONBOARDING_RECURSIVE_SOURCE_FILES.flatMap((file) => [
  file,
  `**/${file}`,
]);
export const ONBOARDING_SOURCE_PATTERNS = ONBOARDING_RECURSIVE_PATTERNS.concat([
  "Dockerfile",
  "Dockerfile.*",
  "**/Dockerfile",
  "**/Dockerfile.*",
  ".github/workflows/*.yml",
  ".github/workflows/*.yaml",
  "**/.github/workflows/*.yml",
  "**/.github/workflows/*.yaml",
]);

export const ONBOARDING_DEPENDENCY_SECTIONS: OnboardingDependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export const ONBOARDING_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
export const ONBOARDING_SCAN_IGNORE_PATTERNS = ["**/coverage/**", "**/dist/**"];

export const ONBOARDING_MANAGERS = new Set<OnboardingManager>(["bun", "npm", "pnpm", "yarn"]);

export const ONBOARDING_MANAGER_FILES: Record<OnboardingManager, string[]> = {
  bun: ["bun.lock", "bun.lockb", "bunfig.toml"],
  npm: ["package-lock.json", "npm-shrinkwrap.json"],
  pnpm: ["pnpm-lock.yaml", "pnpm-workspace.yaml"],
  yarn: ["yarn.lock", ".yarnrc", ".yarnrc.yml"],
};

export const ONBOARDING_ACTION_REF = ACTION_REF;
export const ONBOARDING_CHECKOUT_REF = CHECKOUT_REF;
export const ONBOARDING_SCHEDULE = DEFAULT_ACTION_SCHEDULE;
export const ONBOARDING_SECRET_NAME = DEFAULT_TOKEN_SECRET;
export const ONBOARDING_VERSION_PATTERN = EXACT_TOOL_VERSION_PATTERN;
export const ONBOARDING_CONFIG_PATH = ".codependencerc";
export const ONBOARDING_WORKFLOW_PATH = ".github/workflows/codependence-node.yml";
export const ONBOARDING_PAT_URL = "https://github.com/settings/personal-access-tokens/new";
export const ONBOARDING_GITHUB_API_URL = "https://api.github.com";
export const ONBOARDING_GITHUB_RAW_URL = "https://raw.githubusercontent.com";

export const ONBOARDING_INSTALLS: Record<OnboardingManager, string[]> = {
  bun: ["add", "--dev", "codependence"],
  npm: ["install", "--save-dev", "codependence"],
  pnpm: ["add", "--save-dev", "codependence"],
  yarn: ["add", "--dev", "codependence"],
};

export const ONBOARDING_WORKSPACE_INSTALLS: Partial<Record<OnboardingManager, string[]>> = {
  pnpm: ["add", "--save-dev", "-w", "codependence"],
  yarn: ["add", "--dev", "-W", "codependence"],
};

export const ONBOARDING_VERIFY_COMMANDS: Record<OnboardingManager, string> = {
  bun: "bunx codependence",
  npm: "npx codependence",
  pnpm: "pnpm exec codependence",
  yarn: "yarn codependence",
};

export const ONBOARDING_TOKEN_PERMISSIONS = [
  "Contents: Read and write",
  "Pull requests: Read and write",
];

export const ONBOARDING_MANAGER_ORDER: OnboardingManager[] = ["bun", "pnpm", "yarn", "npm"];
export const ONBOARDING_REPOSITORY_CONCURRENCY = 6;
export const ONBOARDING_USAGE_SEPARATOR = "\u0000";
