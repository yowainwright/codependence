export const DOCKER_PACKAGE_MANAGER = "docker";

export const DOCKER_PATTERNS = {
  ARG_LINE:
    /^(\s*ARG\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(["']?)([^"'\s#]+)\4(.*)$/i,
  ARG_REFERENCE: /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
  FROM_LINE: /^(\s*FROM\s+(?:--platform=\S+\s+)?)([^\s@]+)(.*)$/i,
  PACKAGE_NAME:
    /^(?:[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]+)?\/)?[A-Za-z0-9][A-Za-z0-9._/-]*$/,
} as const;
