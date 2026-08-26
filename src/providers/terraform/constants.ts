export const TERRAFORM_PACKAGE_MANAGER = "terraform";

export const TERRAFORM_PATTERNS = {
  BLOCK_START: /^\s*([A-Za-z0-9_-]+)(?:\s+"[^"]+")?\s*\{\s*(?:#.*)?$/,
  OBJECT_START: /^\s*([A-Za-z0-9_-]+)\s*=\s*\{\s*(?:#.*)?$/,
  STRING_ASSIGNMENT: /^(\s*[A-Za-z0-9_-]+\s*=\s*)(["'])(.*?)\2(\s*(?:#.*)?)$/,
} as const;
