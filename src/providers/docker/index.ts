import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  DockerAuthChallenge,
  DockerArgument,
  DockerArgumentReference,
  DockerArguments,
  DockerFetch,
  DockerImage,
  DockerProviderOptions,
  DockerRegistryCredentials,
  DockerRegistryImage,
  DockerRegistryPage,
  DockerTagsResponse,
  DockerTagsPromise,
  DockerTokenResponse,
  DockerVersionTag,
} from "../types";
import {
  DOCKER_AUTH_HOSTS,
  DOCKER_HUB_HOST,
  DOCKER_HUB_LIBRARY,
  DOCKER_HUB_NAMES,
  DOCKER_PATTERNS,
  DOCKER_TAG_PAGE_LIMIT,
  DOCKER_TAG_PAGE_SIZE,
  DOCKER_USER_AGENT,
  GHCR_HOST,
} from "./constants";

export type { DockerProviderOptions } from "../types";

const defaultFetch: DockerFetch = (url, init) => globalThis.fetch(url, init);

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

const environmentCredentials = (
  usernameName: string,
  tokenName: string,
): DockerRegistryCredentials => ({
  username: process.env[usernameName],
  token: process.env[tokenName],
});

const ghcrEnvironmentCredentials = (): DockerRegistryCredentials => {
  const explicit = environmentCredentials("GHCR_USERNAME", "GHCR_TOKEN");
  if (explicit.username || explicit.token) return explicit;

  const username = process.env.GITHUB_ACTOR;
  const token = username ? process.env.GITHUB_TOKEN : undefined;
  return { username, token };
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

const resolveRegistryImage = (packageName: string): DockerRegistryImage => {
  const [first, ...remaining] = packageName.split("/");
  if (first === GHCR_HOST && remaining.length > 0)
    return ghcrImage(packageName, remaining.join("/"));
  if (DOCKER_HUB_NAMES.has(first) && remaining.length > 0) {
    return dockerHubImage(packageName, remaining.join("/"));
  }
  if (DOCKER_PATTERNS.REGISTRY_HOST.test(first)) {
    throw new Error(`Unsupported Docker registry for ${packageName}; use Docker Hub or GHCR`);
  }

  return dockerHubImage(packageName, packageName);
};

const encodedRepository = (name: string): string =>
  name.split("/").map(encodeURIComponent).join("/");

const tagsUrl = (image: DockerRegistryImage): string => {
  const repository = encodedRepository(image.name);
  return `https://${image.host}/v2/${repository}/tags/list?n=${DOCKER_TAG_PAGE_SIZE}`;
};

const registryHeaders = (authorization?: string): Record<string, string> => {
  const headers = { Accept: "application/json", "User-Agent": DOCKER_USER_AGENT };
  if (!authorization) return headers;

  return { ...headers, Authorization: authorization };
};

const basicAuthorization = (credentials: DockerRegistryCredentials): string | undefined => {
  const hasCredentials = credentials.username || credentials.token;
  if (!hasCredentials) return undefined;
  if (!credentials.username || !credentials.token) {
    throw new Error("Docker registry credentials require both username and token");
  }

  const value = Buffer.from(`${credentials.username}:${credentials.token}`, "utf8").toString(
    "base64",
  );
  return `Basic ${value}`;
};

const parseAuthChallenge = (header: string | null): DockerAuthChallenge => {
  const bearer = header?.match(DOCKER_PATTERNS.BEARER_CHALLENGE);
  if (!bearer) throw new Error("Docker registry did not provide a Bearer authentication challenge");

  const matches = bearer[1].matchAll(DOCKER_PATTERNS.AUTH_ATTRIBUTE);
  const attributes = Object.fromEntries(Array.from(matches, (match) => [match[1], match[2]]));
  const realm = attributes.realm;
  const service = attributes.service;
  if (!realm || !service) throw new Error("Docker registry authentication challenge is incomplete");

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

const authenticationUrl = (image: DockerRegistryImage, challenge: DockerAuthChallenge): URL => {
  const url = trustedAuthUrl(image, challenge.realm);
  const scope = `repository:${image.name}:pull`;
  url.searchParams.set("service", challenge.service);
  url.searchParams.set("scope", scope);
  return url;
};

const responseStatus = (response: Response): string => {
  if (!response.statusText) return response.status.toString();
  return `${response.status} ${response.statusText}`;
};

const readRegistryJson = async (response: Response, message: string): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new Error(message);
  }
};

const assertRegistryResponse = (response: Response, image: DockerRegistryImage): void => {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
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

const readRegistryToken = async (
  response: Response,
  image: DockerRegistryImage,
): Promise<string> => {
  assertRegistryResponse(response, image);
  const errorMessage = `Docker registry returned invalid authentication JSON for ${image.displayName}`;
  const body = (await readRegistryJson(response, errorMessage)) as DockerTokenResponse;
  const token = typeof body.token === "string" ? body.token : body.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error(
      `Docker authentication response did not include a token for ${image.displayName}`,
    );
  }

  return token;
};

const readTags = async (response: Response, image: DockerRegistryImage): Promise<string[]> => {
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

const nextTagsUrl = (
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

  return (right.parts[index] || 0) - (left.parts[index] || 0);
};

const matchingVersionTag = (
  candidate: DockerVersionTag | null,
  current: DockerVersionTag,
): candidate is DockerVersionTag => {
  if (!candidate) return false;
  return candidate.prefix === current.prefix && candidate.suffix === current.suffix;
};

const assertResolvableTag = (packageName: string, version: string): void => {
  if (parseVersionTag(version)) return;
  throw new Error(`Docker cannot safely resolve mutable tag ${packageName}:${version}`);
};

const latestCompatibleTag = (
  tags: string[],
  currentVersion: string,
  packageName: string,
): string => {
  const current = parseVersionTag(currentVersion);
  if (!current)
    throw new Error(`Docker cannot safely resolve tag ${packageName}:${currentVersion}`);

  const candidates = tags.map(parseVersionTag).filter((tag) => matchingVersionTag(tag, current));
  const latest = candidates.sort(compareVersionTags)[0];
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
  if (!hasPrefix || !hasSuffix) return null;

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

const readDockerArguments = (lines: string[]): DockerArguments =>
  lines.reduce((args, line) => {
    const argument = readDockerArgument(line);
    if (argument) args[argument.name] = argument.value;
    return args;
  }, {} as DockerArguments);

const requestedArgumentUpdate = (
  line: string,
  args: DockerArguments,
  dependencies: Record<string, string>,
): readonly [string, string] | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match || match[3].trimStart().startsWith("@")) return null;

  const imageSpec = splitDockerImage(match[2]);
  if (hasDockerVariable(imageSpec.name) || isScratchImage(imageSpec)) return null;

  const reference = dockerArgumentReference(imageSpec.version);
  if (!reference) return null;

  const argumentDefault = args[reference.name];
  const version = dependencies[imageSpec.name];
  if (!argumentDefault || !version) return null;

  const argumentValue = argumentValueForVersion(version, reference);
  return argumentValue ? [reference.name, argumentValue] : null;
};

const collectArgumentUpdates = (
  lines: string[],
  args: DockerArguments,
  dependencies: Record<string, string>,
): DockerArguments => {
  const updates: DockerArguments = {};
  const conflicts = new Set<string>();

  lines.forEach((line) => {
    const update = requestedArgumentUpdate(line, args, dependencies);
    if (!update) return;

    const [name, version] = update;
    if (updates[name] && updates[name] !== version) conflicts.add(name);
    updates[name] = version;
  });

  conflicts.forEach((name) => delete updates[name]);
  return updates;
};

const updateDockerArgumentLine = (line: string, updates: DockerArguments): string => {
  const match = line.match(DOCKER_PATTERNS.ARG_LINE);
  if (!match) return line;

  const version = updates[match[2]];
  if (!version) return line;

  return `${match[1]}${match[2]}${match[3]}${match[4]}${version}${match[4]}${match[6]}`;
};

export const updateDockerFromLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return line;
  if (hasDockerVariable(match[2])) return line;
  if (match[3].trimStart().startsWith("@")) return line;

  const imageSpec = splitDockerImage(match[2]);
  if (isScratchImage(imageSpec)) return line;

  const version = dependencies[imageSpec.name];
  if (!version) return line;

  const updatedImage = `${imageSpec.name}:${version}`;
  const updatedLine = `${match[1]}${updatedImage}${match[3]}`;
  return updatedLine;
};

export class DockerProvider implements DependencyProvider {
  readonly language = LANGUAGES.DOCKER;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "exact",
  } as const;
  private readonly fetch: DockerFetch;
  private readonly dockerHubCredentials: DockerRegistryCredentials;
  private readonly ghcrCredentials: DockerRegistryCredentials;

  constructor(options: DockerProviderOptions = {}) {
    const dockerHubEnvironment = environmentCredentials("DOCKERHUB_USERNAME", "DOCKERHUB_TOKEN");
    this.fetch = options.fetch || defaultFetch;
    this.dockerHubCredentials = options.dockerHubCredentials || dockerHubEnvironment;
    this.ghcrCredentials = options.ghcrCredentials || ghcrEnvironmentCredentials();
  }

  private credentialsFor(image: DockerRegistryImage): DockerRegistryCredentials {
    if (image.registry === "docker-hub") return this.dockerHubCredentials;
    return this.ghcrCredentials;
  }

  private async fetchResponse(
    image: DockerRegistryImage,
    url: string,
    headers: Record<string, string>,
  ) {
    try {
      return await this.fetch(url, { headers });
    } catch {
      throw new Error(`Docker registry network request failed for ${image.displayName}`);
    }
  }

  private async requestToken(image: DockerRegistryImage, response: Response): Promise<string> {
    const challengeHeader = response.headers.get("WWW-Authenticate");
    const challenge = parseAuthChallenge(challengeHeader);
    const url = authenticationUrl(image, challenge);
    const credentials = this.credentialsFor(image);
    const basic = basicAuthorization(credentials);
    const headers = registryHeaders(basic);
    const tokenResponse = await this.fetchResponse(image, url.toString(), headers);
    const token = await readRegistryToken(tokenResponse, image);
    const authorization = `Bearer ${token}`;
    return authorization;
  }

  private async requestTagsPage(image: DockerRegistryImage, url: string, authorization?: string) {
    const headers = registryHeaders(authorization);
    const response = await this.fetchResponse(image, url, headers);
    const requiresAuthentication = response.status === 401 && !authorization;
    if (!requiresAuthentication) {
      assertRegistryResponse(response, image);
      const page: DockerRegistryPage = { authorization, response };
      return page;
    }

    const nextAuthorization = await this.requestToken(image, response);
    const nextHeaders = registryHeaders(nextAuthorization);
    const nextResponse = await this.fetchResponse(image, url, nextHeaders);
    assertRegistryResponse(nextResponse, image);
    const page: DockerRegistryPage = { authorization: nextAuthorization, response: nextResponse };
    return page;
  }

  private assertUnvisited(image: DockerRegistryImage, url: string, visited: Set<string>): void {
    const reachedLimit = visited.size >= DOCKER_TAG_PAGE_LIMIT;
    if (!visited.has(url) && !reachedLimit) return;

    throw new Error(`Docker registry pagination limit exceeded for ${image.displayName}`);
  }

  private async collectTags(
    image: DockerRegistryImage,
    url: string,
    authorization: string | undefined,
    visited: Set<string>,
  ): DockerTagsPromise {
    this.assertUnvisited(image, url, visited);
    visited.add(url);
    const page = await this.requestTagsPage(image, url, authorization);
    const tags = await readTags(page.response, image);
    const nextUrl = nextTagsUrl(page.response, url, image);
    if (!nextUrl) return tags;

    const remaining = await this.collectTags(image, nextUrl, page.authorization, visited);
    return tags.concat(remaining);
  }

  async getLatestVersion(packageName: string, currentVersion?: string) {
    if (!currentVersion) {
      throw new Error(`Docker latest resolution requires a current tag for ${packageName}`);
    }

    assertResolvableTag(packageName, currentVersion);
    const tags = await this.getAllVersions(packageName);
    const latest = latestCompatibleTag(tags, currentVersion, packageName);
    return latest;
  }

  async getAllVersions(packageName: string) {
    const image = resolveRegistryImage(packageName);
    const initialUrl = tagsUrl(image);
    const visited = new Set<string>();
    const tags = await this.collectTags(image, initialUrl, undefined, visited);
    return tags;
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyManifest(filePath);
    const content = readFileSync(filePath, "utf8");
    const args: DockerArguments = {};

    content.split("\n").forEach((line) => {
      const argument = readDockerArgument(line);
      if (argument) args[argument.name] = argument.value;

      const imageSpec = readDockerFromLine(line, args);
      if (!imageSpec) return;

      appendDependencyVersion(manifest, imageSpec);
    });

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const args = readDockerArguments(lines);
    const updates = collectArgumentUpdates(lines, args, manifest.dependencies);
    const updatedLines = lines.map((line) => {
      const updatedArgument = updateDockerArgumentLine(line, updates);
      return updateDockerFromLine(updatedArgument, manifest.dependencies);
    });

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = packageName.match(DOCKER_PATTERNS.PACKAGE_NAME) !== null;
    return isValid;
  }
}
