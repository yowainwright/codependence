import type { GitResult } from "../../../scripts/tag-release";

export const READY_GIT_OVERRIDES: Record<string, GitResult> = {
  "branch --show-current": { status: 0, stdout: "main\n", stderr: "" },
  "status --short": { status: 0, stdout: "", stderr: "" },
  "rev-parse HEAD": { status: 0, stdout: "abc\n", stderr: "" },
  "rev-parse origin/main": { status: 0, stdout: "abc\n", stderr: "" },
  "rev-parse -q --verify refs/tags/v1.2.3-beta.6": {
    status: 1,
    stdout: "",
    stderr: "missing",
  },
  "ls-remote --exit-code --tags origin refs/tags/v1.2.3-beta.6": {
    status: 2,
    stdout: "",
    stderr: "",
  },
};

export const READY_RELEASE_OVERRIDES: Record<string, GitResult> = {
  "git branch --show-current": { status: 0, stdout: "main\n", stderr: "" },
  "git status --short": { status: 0, stdout: "", stderr: "" },
  "git fetch origin main --tags": { status: 0, stdout: "", stderr: "" },
  "git rev-parse HEAD": { status: 0, stdout: "abc\n", stderr: "" },
  "git rev-parse origin/main": { status: 0, stdout: "abc\n", stderr: "" },
};

export const MISSING_TAG_OVERRIDES: Record<string, GitResult> = {
  "git rev-parse -q --verify refs/tags/v1.2.4": {
    status: 2,
    stdout: "",
    stderr: "",
  },
  "git ls-remote --exit-code --tags origin refs/tags/v1.2.4": {
    status: 2,
    stdout: "",
    stderr: "",
  },
};

export const AVAILABLE_VERSION_OVERRIDES: Record<string, GitResult> = {
  "git rev-parse -q --verify refs/tags/v1.2.4": {
    status: 2,
    stdout: "",
    stderr: "",
  },
  "git ls-remote --tags origin refs/tags/v1.2.4": {
    status: 0,
    stdout: "",
    stderr: "",
  },
};
