import type { GitResult } from "../../../scripts/release";

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
