import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  DockerFetch,
  DockerProviderOptions,
  DockerRegistryCredentials,
  DockerRegistryImage,
  DockerRegistryPage,
  DockerTagsPromise,
} from "../types";
import {
  DOCKER_PATTERNS,
  DOCKER_REGISTRY_REQUEST_ATTEMPTS,
  DOCKER_TAG_PAGE_LIMIT,
} from "./constants";

export type { DockerProviderOptions } from "../types";

import {
  defaultFetch,
  environmentCredentials,
  ghcrEnvironmentCredentials,
  resolveRegistryImage,
  tagsUrl,
  registryHeaders,
  basicAuthorization,
  parseAuthChallenge,
  authenticationUrl,
  isAuthenticationFailure,
  isTransientRegistryFailure,
  assertRegistryResponse,
  readRegistryToken,
  readTags,
  nextTagsUrl,
  assertResolvableTag,
  latestCompatibleTag,
  readDockerArguments,
  collectArgumentUpdates,
  updateDockerArgumentLine,
  updateDockerFromLine,
  parseManifest,
  capabilities,
} from "./utils";
export { updateDockerFromLine } from "./utils";

export class DockerProvider implements DependencyProvider {
  readonly language = LANGUAGES.DOCKER;
  readonly capabilities = capabilities;
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
    attempt = 1,
  ) {
    try {
      const response = await this.fetch(url, { headers });
      const shouldRetry =
        isTransientRegistryFailure(response) && attempt < DOCKER_REGISTRY_REQUEST_ATTEMPTS;
      if (!shouldRetry) return response;
    } catch {
      if (attempt >= DOCKER_REGISTRY_REQUEST_ATTEMPTS) {
        throw new Error(`Docker registry network request failed for ${image.displayName}`);
      }
    }

    return this.fetchResponse(image, url, headers, attempt + 1);
  }

  private async requestToken(image: DockerRegistryImage, response: Response): Promise<string> {
    const challengeHeader = response.headers.get("WWW-Authenticate");
    const challenge = parseAuthChallenge(challengeHeader);
    const url = authenticationUrl(image, challenge);
    const credentials = this.credentialsFor(image);
    const basic = basicAuthorization(credentials);
    const headers = registryHeaders(basic);
    const credentialResponse = await this.fetchResponse(image, url, headers);
    const shouldRetryAnonymously =
      image.registry === "ghcr" && basic && isAuthenticationFailure(credentialResponse);
    const tokenResponse = shouldRetryAnonymously
      ? await this.fetchResponse(image, url, registryHeaders())
      : credentialResponse;
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
    const canVisit = !visited.has(url) && !reachedLimit;
    if (canVisit) return;

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
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const args = readDockerArguments(lines);
    const resolvedVersions = manifest.resolvedDependencyVersions;
    const updates = collectArgumentUpdates(lines, args, manifest.dependencies, resolvedVersions);
    const updatedLines = lines.map((line) => {
      const updatedArgument = updateDockerArgumentLine(line, updates);
      return updateDockerFromLine(updatedArgument, manifest.dependencies, resolvedVersions);
    });

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = packageName.match(DOCKER_PATTERNS.PACKAGE_NAME) !== null;
    return isValid;
  }
}
