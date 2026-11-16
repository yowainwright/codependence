import type {
  DependencyManifest,
  DockerAuthChallenge,
  DockerArgument,
  DockerArgumentReference,
  DockerArguments,
  DockerFetch,
  DockerImage,
  DockerRegistryCredentials,
  DockerRegistryImage,
  DockerTagsResponse,
  DockerTokenResponse,
  DockerVersionTag,
  ResolvedDependencyVersions,
} from "../types";
import {
  DOCKER_AUTH_HOSTS,
  DOCKER_BEARER_PREFIX,
  DOCKER_HUB_HOST,
  DOCKER_HUB_LIBRARY,
  DOCKER_HUB_NAMES,
  DOCKER_PATTERNS,
  DOCKER_TAG_PAGE_SIZE,
  DOCKER_TRANSIENT_REGISTRY_STATUSES,
  DOCKER_USER_AGENT,
  GHCR_HOST,
} from "./constants";

export type { DockerProviderOptions } from "../types";

export const capabilities = {
  supportsLatestResolution: true,
  supportsPreciseMode: true,
  versionStrategy: "exact",
} as const;

export const defaultFetch: DockerFetch = globalThis.fetch.bind(globalThis);

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
    dependencyVersions: {},
  };
  return manifest;
};

const isScratchImage = (image: DockerImage): boolean => image.name === "scratch";

const hasDockerVariable = (image: string): boolean => image.includes("$");

const readDockerArgument = (line: string): DockerArgument | null => {
  const match = line.match(DOCKER_PATTERNS.ARG_LINE);
  if (!match) return null;

  return { name: match[2], value: match[5] };
};

const dockerArgumentReference = (value: string): DockerArgumentReference | null => {
  const match = value.match(DOCKER_PATTERNS.ARG_REFERENCE);
  if (!match) return null;

  const matchIndex = match.index || 0;
  const prefix = value.slice(0, matchIndex);
  const suffix = value.slice(matchIndex + match[0].length);
  const remainingValue = `${prefix}${suffix}`;
  if (remainingValue.includes("$")) return null;

  const name = match[1] || match[2];
  return name ? { name, prefix, suffix } : null;
};

const splitDockerImage = (image: string): DockerImage => {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;

  if (!hasTag) {
    const imageSpec = { name: image, version: "latest" };
    return imageSpec;
  }

  const name = image.slice(0, lastColon);
  const version = image.slice(lastColon + 1);
  const imageSpec = { name, version };
  return imageSpec;
};

export const environmentCredentials = (
  usernameName: string,
  tokenName: string,
): DockerRegistryCredentials => ({
  username: process.env[usernameName],
  token: process.env[tokenName],
});

export const ghcrEnvironmentCredentials = (): DockerRegistryCredentials => {
  const explicit = environmentCredentials("GHCR_USERNAME", "GHCR_TOKEN");
  const hasExplicitCredentials = Boolean(explicit.username || explicit.token);
  if (hasExplicitCredentials) return explicit;

  return environmentCredentials("GITHUB_ACTOR", "GITHUB_TOKEN");
};

const dockerHubImage = (displayName: string, name: string): DockerRegistryImage => {
  const repository = name.includes("/") ? name : `${DOCKER_HUB_LIBRARY}/${name}`;
  return {
    displayName,
    host: DOCKER_HUB_HOST,
    name: repository,
    registry: "docker-hub",
  };
};

const ghcrImage = (displayName: string, name: string): DockerRegistryImage => ({
  displayName,
  host: GHCR_HOST,
  name,
  registry: "ghcr",
});

const isRegistryHost = (value: string): boolean => /[.:]/.test(value) || value === "localhost";

export const resolveRegistryImage = (packageName: string): DockerRegistryImage => {
  const [first, ...remaining] = packageName.split("/");
  const hasRepository = remaining.length > 0;
  const isGhcrImage = first === GHCR_HOST && hasRepository;
  if (isGhcrImage) return ghcrImage(packageName, remaining.join("/"));
  const isDockerHubImage = DOCKER_HUB_NAMES.has(first) && hasRepository;
  if (isDockerHubImage) {
    return dockerHubImage(packageName, remaining.join("/"));
  }
  if (isRegistryHost(first)) {
    throw new Error(`Unsupported Docker registry for ${packageName}; use Docker Hub or GHCR`);
  }

  return dockerHubImage(packageName, packageName);
};

const encodedRepository = (name: string): string =>
  name.split("/").map(encodeURIComponent).join("/");

export const tagsUrl = (image: DockerRegistryImage): string => {
  const repository = encodedRepository(image.name);
  return `https://${image.host}/v2/${repository}/tags/list?n=${DOCKER_TAG_PAGE_SIZE}`;
};

export const registryHeaders = (authorization?: string): Record<string, string> => {
  const headers = { Accept: "application/json", "User-Agent": DOCKER_USER_AGENT };
  if (!authorization) return headers;

  return Object.assign({}, headers, { Authorization: authorization });
};

export const basicAuthorization = (credentials: DockerRegistryCredentials): string | undefined => {
  const hasCredentials = credentials.username || credentials.token;
  if (!hasCredentials) return undefined;
  const hasCompleteCredentials = Boolean(credentials.username && credentials.token);
  if (!hasCompleteCredentials) {
    throw new Error("Docker registry credentials require both username and token");
  }

  const value = Buffer.from(`${credentials.username}:${credentials.token}`, "utf8").toString(
    "base64",
  );
  return `Basic ${value}`;
};

const authAttributes = (value: string): Record<string, string> =>
  value.split(",").reduce<Record<string, string>>((attributes, item) => {
    const separator = item.indexOf("=");
    if (separator < 1) return attributes;

    const name = item.slice(0, separator).trim();
    const rawValue = item.slice(separator + 1).trim();
    const hasQuotes = rawValue.startsWith('"') && rawValue.endsWith('"');
    const isNamedQuotedValue = Boolean(name && hasQuotes);
    if (isNamedQuotedValue) attributes[name] = rawValue.slice(1, -1);
    return attributes;
  }, {});

export const parseAuthChallenge = (header: string | null): DockerAuthChallenge => {
  if (!header) throw new Error("Docker registry did not provide a Bearer authentication challenge");
  const scheme = header?.slice(0, DOCKER_BEARER_PREFIX.length).toLowerCase();
  const hasValidChallenge = Boolean(header) && scheme === DOCKER_BEARER_PREFIX;
  if (!hasValidChallenge) {
    throw new Error("Docker registry did not provide a Bearer authentication challenge");
  }

  const attributes = authAttributes(header.slice(DOCKER_BEARER_PREFIX.length));
  const realm = attributes.realm;
  const service = attributes.service;
  const hasChallengeCredentials = Boolean(realm && service);
  if (!hasChallengeCredentials) {
    throw new Error("Docker registry authentication challenge is incomplete");
  }

  return { realm, service };
};

const parseDockerUrl = (value: string, base: string | undefined, message: string): URL => {
  try {
    if (base) return new URL(value, base);
    return new URL(value);
  } catch {
    throw new Error(message);
  }
};

const trustedAuthUrl = (image: DockerRegistryImage, realm: string): URL => {
  const errorMessage = `Untrusted Docker authentication URL for ${image.displayName}`;
  const url = parseDockerUrl(realm, undefined, errorMessage);
  const host = image.host as keyof typeof DOCKER_AUTH_HOSTS;
  const allowedHosts = DOCKER_AUTH_HOSTS[host];
  const hasTrustedHost = allowedHosts?.has(url.hostname);
  const hasCredentials = Boolean(url.username || url.password);
  const isTrusted = url.protocol === "https:" && hasTrustedHost && !hasCredentials;
  if (!isTrusted) throw new Error(errorMessage);

  return url;
};

export const authenticationUrl = (
  image: DockerRegistryImage,
  challenge: DockerAuthChallenge,
): string => {
  const url = trustedAuthUrl(image, challenge.realm);
  const scope = `repository:${image.name}:pull`;
  const serviceQuery = `service=${encodeURIComponent(challenge.service)}`;
  const scopeQuery = `scope=${encodeURIComponent(scope)}`;
  const separator = url.search ? "&" : "?";
  return `${url.toString()}${separator}${serviceQuery}&${scopeQuery}`;
};

const responseStatus = (response: Response): string => {
  if (!response.statusText) return response.status.toString();
  return `${response.status} ${response.statusText}`;
};

export const isAuthenticationFailure = (response: Response): boolean =>
  response.status === 401 || response.status === 403;

export const isTransientRegistryFailure = (response: Response): boolean =>
  DOCKER_TRANSIENT_REGISTRY_STATUSES.has(response.status);

const readRegistryJson = async (response: Response, message: string): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new Error(message);
  }
};

export const assertRegistryResponse = (response: Response, image: DockerRegistryImage): void => {
  if (response.ok) return;
  if (isAuthenticationFailure(response)) {
    throw new Error(`Docker registry authentication failed for ${image.displayName}`);
  }
  if (response.status === 404) {
    throw new Error(`Docker image not found: ${image.displayName}`);
  }
  if (response.status === 429) {
    throw new Error(`Docker registry rate limit exceeded for ${image.displayName}`);
  }

  throw new Error(
    `Docker registry request failed for ${image.displayName}: ${responseStatus(response)}`,
  );
};

export const readRegistryToken = async (
  response: Response,
  image: DockerRegistryImage,
): Promise<string> => {
  assertRegistryResponse(response, image);
  const errorMessage = `Docker registry returned invalid authentication JSON for ${image.displayName}`;
  const body = (await readRegistryJson(response, errorMessage)) as DockerTokenResponse;
  const token = typeof body.token === "string" ? body.token : body.access_token;
  const hasValidToken = typeof token === "string" && Boolean(token);
  if (!hasValidToken) {
    throw new Error(
      `Docker authentication response did not include a token for ${image.displayName}`,
    );
  }

  return token;
};

export const readTags = async (
  response: Response,
  image: DockerRegistryImage,
): Promise<string[]> => {
  const errorMessage = `Docker registry returned invalid tags JSON for ${image.displayName}`;
  const body = (await readRegistryJson(response, errorMessage)) as DockerTagsResponse;
  if (!Array.isArray(body.tags)) {
    throw new Error(`Docker registry returned invalid tags for ${image.displayName}`);
  }

  return body.tags.filter((tag): tag is string => typeof tag === "string");
};

const nextLinkMatch = (link: string | null): RegExpMatchArray | null => {
  if (!link) return null;
  const quoted = link.match(DOCKER_PATTERNS.NEXT_LINK);
  if (quoted) return quoted;
  return link.match(DOCKER_PATTERNS.NEXT_LINK_UNQUOTED);
};

export const nextTagsUrl = (
  response: Response,
  currentUrl: string,
  image: DockerRegistryImage,
): string | null => {
  const link = response.headers.get("Link");
  const match = nextLinkMatch(link);
  if (!match) return null;

  const errorMessage = `Untrusted Docker pagination URL for ${image.displayName}`;
  const next = parseDockerUrl(match[1], currentUrl, errorMessage);
  const repository = encodedRepository(image.name);
  const expectedPath = `/v2/${repository}/tags/list`;
  const isTrusted = next.protocol === "https:" && next.host === image.host;
  const hasCredentials = Boolean(next.username || next.password);
  const isInvalid = !isTrusted || next.pathname !== expectedPath || hasCredentials;
  if (isInvalid) {
    throw new Error(errorMessage);
  }

  return next.toString();
};

const parseVersionTag = (name: string): DockerVersionTag | null => {
  const match = name.match(DOCKER_PATTERNS.VERSION_TAG);
  if (!match) return null;

  const parts = match[2].split(".").map(Number);
  return {
    name,
    parts,
    prefix: match[1],
    specificity: parts.length,
    suffix: match[4],
  };
};

const compareVersionTags = (left: DockerVersionTag, right: DockerVersionTag): number => {
  const index = left.parts.findIndex((part, partIndex) => part !== right.parts[partIndex]);
  if (index === -1) return right.specificity - left.specificity;

  const rightPart = right.parts[index] || 0;
  const leftPart = left.parts[index] || 0;
  return rightPart - leftPart;
};

const matchingVersionTag = (
  candidate: DockerVersionTag | null,
  current: DockerVersionTag,
): candidate is DockerVersionTag => {
  if (!candidate) return false;
  const hasCompatibleSpecificity = candidate.specificity >= current.specificity;
  const hasMatchingFormat =
    candidate.prefix === current.prefix && candidate.suffix === current.suffix;
  return hasCompatibleSpecificity && hasMatchingFormat;
};

export const assertResolvableTag = (packageName: string, version: string): void => {
  if (parseVersionTag(version)) return;
  throw new Error(`Docker cannot safely resolve mutable tag ${packageName}:${version}`);
};

export const latestCompatibleTag = (
  tags: string[],
  currentVersion: string,
  packageName: string,
): string => {
  const current = parseVersionTag(currentVersion);
  if (!current)
    throw new Error(`Docker cannot safely resolve tag ${packageName}:${currentVersion}`);

  const candidates = tags.map(parseVersionTag).filter((tag) => matchingVersionTag(tag, current));
  const latest = candidates.concat().sort(compareVersionTags)[0];
  if (latest) return latest.name;

  throw new Error(`No compatible Docker tags found for ${packageName}:${currentVersion}`);
};

const appendDependencyVersion = (manifest: DependencyManifest, image: DockerImage): void => {
  const dependencyVersions = manifest.dependencyVersions || {};
  const currentVersions = dependencyVersions[image.name] || [];
  dependencyVersions[image.name] = currentVersions.concat(image.version);
  manifest.dependencyVersions = dependencyVersions;
  manifest.dependencies[image.name] = image.version;
};

const resolveDockerVersion = (version: string, args: DockerArguments): string | null => {
  if (!hasDockerVariable(version)) return version;

  const reference = dockerArgumentReference(version);
  if (!reference) return null;

  const argumentValue = args[reference.name];
  return argumentValue ? `${reference.prefix}${argumentValue}${reference.suffix}` : null;
};

const argumentValueForVersion = (
  version: string,
  reference: DockerArgumentReference,
): string | null => {
  const hasPrefix = version.startsWith(reference.prefix);
  const hasSuffix = version.endsWith(reference.suffix);
  const hasValidVersionFormat = hasPrefix && hasSuffix;
  if (!hasValidVersionFormat) return null;

  const suffixStart = reference.suffix ? -reference.suffix.length : undefined;
  return version.slice(reference.prefix.length, suffixStart) || null;
};

const readDockerFromLine = (line: string, args: DockerArguments): DockerImage | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return null;
  if (match[3].trimStart().startsWith("@")) return null;

  const imageSpec = splitDockerImage(match[2]);
  if (hasDockerVariable(imageSpec.name)) return null;
  if (isScratchImage(imageSpec)) return null;

  const version = resolveDockerVersion(imageSpec.version, args);
  if (!version) return null;

  return { name: imageSpec.name, version };
};

export const readDockerArguments = (lines: string[]): DockerArguments =>
  lines.reduce((args, line) => {
    const argument = readDockerArgument(line);
    if (argument) args[argument.name] = argument.value;
    return args;
  }, {} as DockerArguments);

const targetVersionFor = (
  image: DockerImage,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): string | undefined =>
  resolvedDependencyVersions?.[image.name]?.[image.version] || dependencies[image.name];

const requestedArgumentUpdate = (
  line: string,
  args: DockerArguments,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): readonly [string, string] | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  const isDigestReference = match?.[3].trimStart().startsWith("@");
  const hasUnsupportedReference = !match || isDigestReference;
  if (hasUnsupportedReference) return null;

  const imageSpec = splitDockerImage(match[2]);
  const isUnsupportedImage = hasDockerVariable(imageSpec.name) || isScratchImage(imageSpec);
  if (isUnsupportedImage) return null;

  const reference = dockerArgumentReference(imageSpec.version);
  if (!reference) return null;

  const argumentDefault = args[reference.name];
  const currentVersion = resolveDockerVersion(imageSpec.version, args);
  const hasArgumentVersion = Boolean(argumentDefault && currentVersion);
  if (!hasArgumentVersion) return null;
  if (!currentVersion) return null;

  const image = { name: imageSpec.name, version: currentVersion };
  const version = targetVersionFor(image, dependencies, resolvedDependencyVersions);
  if (!version) return null;

  const argumentValue = argumentValueForVersion(version, reference);
  return argumentValue ? [reference.name, argumentValue] : null;
};

export const collectArgumentUpdates = (
  lines: string[],
  args: DockerArguments,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): DockerArguments => {
  const updates: DockerArguments = {};
  const conflicts = new Set<string>();

  lines.forEach((line) => {
    const update = requestedArgumentUpdate(line, args, dependencies, resolvedDependencyVersions);
    if (!update) return;

    const [name, version] = update;
    const hasConflict = updates[name] && updates[name] !== version;
    if (hasConflict) conflicts.add(name);
    updates[name] = version;
  });

  conflicts.forEach((name) => delete updates[name]);
  return updates;
};

export const updateDockerArgumentLine = (line: string, updates: DockerArguments): string => {
  const match = line.match(DOCKER_PATTERNS.ARG_LINE);
  if (!match) return line;

  const version = updates[match[2]];
  if (!version) return line;

  return `${match[1]}${match[2]}${match[3]}${match[4]}${version}${match[4]}${match[6]}`;
};

export const updateDockerFromLine = (
  line: string,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): string => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return line;
  if (hasDockerVariable(match[2])) return line;
  if (match[3].trimStart().startsWith("@")) return line;

  const imageSpec = splitDockerImage(match[2]);
  if (isScratchImage(imageSpec)) return line;

  const version = targetVersionFor(imageSpec, dependencies, resolvedDependencyVersions);
  if (!version) return line;

  const updatedImage = `${imageSpec.name}:${version}`;
  const updatedLine = `${match[1]}${updatedImage}${match[3]}`;
  return updatedLine;
};

export const parseManifest = (filePath: string, content: string): DependencyManifest => {
  const manifest = emptyManifest(filePath);
  const args: DockerArguments = {};

  content.split("\n").forEach((line) => {
    const argument = readDockerArgument(line);
    if (argument) args[argument.name] = argument.value;

    const imageSpec = readDockerFromLine(line, args);
    if (!imageSpec) return;

    appendDependencyVersion(manifest, imageSpec);
  });

  return manifest;
};
