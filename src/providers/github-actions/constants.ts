export const GITHUB_ACTIONS_PACKAGE_MANAGER = "github-actions";
export const DEFAULT_GITHUB_API_URL = "https://api.github.com";
export const STABLE_VERSION_TAG = /^v?(\d+)(\.\d+)?(\.\d+)?$/;
export const VERSION_COMMENT = /^\s+#\s+v?\d+(\.\d+){0,2}\s*$/;
export const SAFE_VERSION_LABEL = /^[A-Za-z0-9._/-]+$/;

export const GITHUB_ACTIONS_PACKAGE_NAME_PATTERN =
  "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$";

export const GITHUB_ACTIONS_PATTERNS = {
  PACKAGE_NAME: new RegExp(GITHUB_ACTIONS_PACKAGE_NAME_PATTERN),
  USES_LINE: /^(\s*-?\s*uses:\s*)(['"]?)([^'"\s@]+)@([^'"\s]+)(\2)(.*)$/i,
} as const;
