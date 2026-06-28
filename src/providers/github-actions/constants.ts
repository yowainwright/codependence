export const GITHUB_ACTIONS_PACKAGE_MANAGER = "github-actions";

export const GITHUB_ACTIONS_PACKAGE_NAME_PATTERN =
  "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$";

export const GITHUB_ACTIONS_PATTERNS = {
  PACKAGE_NAME: new RegExp(GITHUB_ACTIONS_PACKAGE_NAME_PATTERN),
  USES_LINE: /^(\s*-?\s*uses:\s*)(['"]?)([^'"\s@]+)@([^'"\s]+)(\2)(.*)$/i,
} as const;
