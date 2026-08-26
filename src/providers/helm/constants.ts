export const HELM_PACKAGE_MANAGER = "helm";
export const HELM_TEMPLATE_PATTERN = /{{|}}/;

export const HELM_PATTERNS = {
  FIELD_LINE: /^(\s*)(-\s+)?([A-Za-z0-9_.-]+)\s*:\s*(.*)$/,
  PACKAGE_NAME: /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
  PLAIN_VERSION_LINE: /^(\s*version\s*:\s*)([^#]*?)(\s*(?:#.*)?)$/,
  QUOTED_VERSION_LINE: /^(\s*version\s*:\s*)(["'])(.*?)\2(.*)$/,
} as const;
