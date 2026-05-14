export const GO_PATTERNS = {
  MODULE: /^module\s+(.+)$/m,
  GO_VERSION: /^go\s+(.+)$/m,
  REQUIRE_BLOCK: /require\s*\(([\s\S]*?)\)/,
  REQUIRE_LINE: /^require\s+([^\s(]+)\s+([^\s]+)$/gm,
  DEPENDENCY_LINE: /^([^\s]+)\s+([^\s]+)/,
  PACKAGE_NAME: /^[a-z0-9.-]+\.[a-z]{2,}\/[\w/-]+$/i,
  VERSION_PREFIX: /^v/,
  REPLACE_BLOCK_START: /^\s*replace\s*\(/,
  REPLACE_LINE: /^\s*replace\b/,
  EXCLUDE_BLOCK_START: /^\s*exclude\s*\(/,
  BLOCK_CLOSE: /^\s*\)/,
  DEP_UPDATE_LINE: /^(\s*(?:require\s+)?)([^\s(]+)(\s+)([^\s]+)(.*)/,
};
