export const DOCKER_PACKAGE_MANAGER = "docker";
export const DOCKER_HUB_HOST = "registry-1.docker.io";
export const DOCKER_HUB_LIBRARY = "library";
export const DOCKER_HUB_NAMES = new Set(["docker.io", "index.docker.io", DOCKER_HUB_HOST]);
export const GHCR_HOST = "ghcr.io";
export const DOCKER_TAG_PAGE_SIZE = 100;
export const DOCKER_TAG_PAGE_LIMIT = 100;
export const DOCKER_USER_AGENT = "codependence";
export const DOCKER_BEARER_PREFIX = "bearer ";
export const DOCKER_AUTH_HOSTS = {
  [DOCKER_HUB_HOST]: new Set(["auth.docker.io"]),
  [GHCR_HOST]: new Set([GHCR_HOST]),
} as const;

export const DOCKER_PATTERNS = {
  ARG_LINE: /^(\s*ARG\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(["']?)([^"'\s#]+)\4(.*)$/i,
  ARG_REFERENCE: /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/,
  FROM_LINE: /^(\s*FROM\s+(?:--platform=\S+\s+)?)([^\s@]+)(.*)$/i,
  NEXT_LINK: /<([^>]+)>\s*;\s*rel="next"/i,
  NEXT_LINK_UNQUOTED: /<([^>]+)>\s*;\s*rel=next/i,
  PACKAGE_NAME: /^(?:[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]+)?\/)?[A-Za-z0-9][A-Za-z0-9._/-]*$/,
  VERSION_TAG: /^(v|)(\d+(\.\d+){0,2})(.*)$/,
} as const;
