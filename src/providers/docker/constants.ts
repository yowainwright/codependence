export const DOCKER_PACKAGE_MANAGER = "docker";

export const DOCKER_PATTERNS = {
  FROM_LINE: /^(\s*FROM\s+(?:--platform=\S+\s+)?)([^\s@]+)(.*)$/i,
  PACKAGE_NAME: /^[a-zA-Z0-9._:/-]+$/,
} as const;
