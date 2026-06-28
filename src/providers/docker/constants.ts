export const DOCKER_PACKAGE_MANAGER = "docker";

export const DOCKER_PATTERNS = {
  FROM_LINE: /^(\s*FROM\s+(?:--platform=\S+\s+)?)([^\s@]+)(.*)$/i,
  PACKAGE_NAME:
    /^(?:[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]+)?\/)?[A-Za-z0-9][A-Za-z0-9._/-]*$/,
} as const;
