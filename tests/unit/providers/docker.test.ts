import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { DockerProvider } from "../../../src/providers/docker";
import type { DockerFetch } from "../../../src/providers/types";

type DockerRequest = { url: string; init?: RequestInit };

const bearerChallenge = (realm: string, service: string, scope: string): string =>
  `Bearer realm="${realm}",service="${service}",scope="${scope}"`;

const mockFetch = (responses: Response[]) => {
  const requests: DockerRequest[] = [];
  const fetch: DockerFetch = async (url, init) => {
    requests.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected request: ${url}`);
    return response;
  };

  return { fetch, requests };
};

const authorizationFor = (request: DockerRequest): string | null =>
  new Headers(request.init?.headers).get("Authorization");

const responseWithStatus = (status: number): Response => new Response(null, { status });

describe("DockerProvider", () => {
  const tmpDir = join(__dirname, ".tmp-docker-test");
  const dockerfilePath = join(tmpDir, "Dockerfile");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", () => {
    const provider = new DockerProvider();

    expect(provider.language).toBe("docker");
    expect(provider.capabilities).toEqual({
      supportsLatestResolution: true,
      supportsPreciseMode: true,
      versionStrategy: "exact",
    });
    expect(provider.validatePackageName("ghcr.io/org/image")).toBe(true);
    expect(provider.validatePackageName("registry.internal:5000/org/image")).toBe(true);
    expect(provider.validatePackageName("bad image")).toBe(false);
  });

  test("should resolve Docker Hub tags with authentication and pagination", async () => {
    const username = "octocat";
    const credential = crypto.randomUUID();
    const registryCredential = crypto.randomUUID();
    const scope = "repository:library/node:pull";
    const challenge = bearerChallenge("https://auth.docker.io/token", "registry.docker.io", scope);
    const challengeHeaders = { "WWW-Authenticate": challenge };
    const unauthorizedInit = { status: 401, headers: challengeHeaders };
    const unauthorized = new Response(null, unauthorizedInit);
    const credentialBody = { token: registryCredential };
    const credentialResponse = Response.json(credentialBody);
    const firstPage = { name: "library/node", tags: ["20-slim", "22.0-slim"] };
    const link = "</v2/library/node/tags/list?n=100&last=22.0-slim>; rel=next";
    const firstHeaders = { Link: link };
    const firstResponseInit = { headers: firstHeaders };
    const firstResponse = Response.json(firstPage, firstResponseInit);
    const secondPage = { name: "library/node", tags: ["24.1.0-slim", "latest"] };
    const secondResponse = Response.json(secondPage);
    const responses = [unauthorized, credentialResponse, firstResponse, secondResponse];
    const { fetch, requests } = mockFetch(responses);
    const dockerHubCredentials = { username, token: credential };
    const provider = new DockerProvider({ fetch, dockerHubCredentials });
    const registryUrl = "https://registry-1.docker.io/v2/library/node/tags/list?n=100";
    const authenticationUrl = new URL("https://auth.docker.io/token");
    authenticationUrl.searchParams.set("service", "registry.docker.io");
    authenticationUrl.searchParams.set("scope", scope);
    const nextUrl = `${registryUrl}&last=22.0-slim`;
    const expectedUrls = [registryUrl, authenticationUrl.toString(), registryUrl, nextUrl];
    const expectedBasic = `Basic ${btoa(`${username}:${credential}`)}`;
    const expectedBearer = `Bearer ${registryCredential}`;

    await expect(provider.getLatestVersion("node", "20-slim")).resolves.toBe("24.1.0-slim");
    expect(requests.map(({ url }) => url)).toEqual(expectedUrls);
    expect(authorizationFor(requests[1])).toBe(expectedBasic);
    expect(authorizationFor(requests[2])).toBe(expectedBearer);
    expect(authorizationFor(requests[3])).toBe(expectedBearer);
  });

  test("should resolve GHCR tags with configured credentials", async () => {
    const username = "octocat";
    const credential = crypto.randomUUID();
    const registryCredential = crypto.randomUUID();
    const scope = "repository:acme/widget:pull";
    const challenge = bearerChallenge("https://ghcr.io/token", "ghcr.io", scope);
    const challengeHeaders = { "WWW-Authenticate": challenge };
    const unauthorizedInit = { status: 401, headers: challengeHeaders };
    const unauthorized = new Response(null, unauthorizedInit);
    const credentialResponse = Response.json({ token: registryCredential });
    const tagBody = {
      name: "acme/widget",
      tags: ["v1.2-alpine", "v2.0-alpine", "2.1-alpine"],
    };
    const tagsResponse = Response.json(tagBody);
    const { fetch, requests } = mockFetch([unauthorized, credentialResponse, tagsResponse]);
    const ghcrCredentials = { username, token: credential };
    const provider = new DockerProvider({ fetch, ghcrCredentials });
    const expectedBasic = `Basic ${btoa(`${username}:${credential}`)}`;
    const expectedBearer = `Bearer ${registryCredential}`;

    await expect(provider.getLatestVersion("ghcr.io/acme/widget", "v1-alpine")).resolves.toBe(
      "v2.0-alpine",
    );
    expect(authorizationFor(requests[1])).toBe(expectedBasic);
    expect(authorizationFor(requests[2])).toBe(expectedBearer);
  });

  test("should resolve public GHCR tags without workflow credentials", async () => {
    const scope = "repository:acme/widget:pull";
    const challenge = bearerChallenge("https://ghcr.io/token", "ghcr.io", scope);
    const unauthorized = new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": challenge },
    });
    const tokenResponse = Response.json({ token: crypto.randomUUID() });
    const tagsResponse = Response.json({ name: "acme/widget", tags: ["1.0"] });
    const { fetch, requests } = mockFetch([unauthorized, tokenResponse, tagsResponse]);
    const provider = new DockerProvider({ fetch, ghcrCredentials: {} });

    await expect(provider.getAllVersions("ghcr.io/acme/widget")).resolves.toEqual(["1.0"]);
    expect(authorizationFor(requests[1])).toBeNull();
  });

  test("should normalize registry-qualified Docker Hub image names", async () => {
    const tagBody = { name: "acme/widget", tags: ["1.0"] };
    const { fetch, requests } = mockFetch([Response.json(tagBody)]);
    const provider = new DockerProvider({ fetch });

    await expect(provider.getAllVersions("docker.io/acme/widget")).resolves.toEqual(["1.0"]);
    expect(requests[0].url).toBe("https://registry-1.docker.io/v2/acme/widget/tags/list?n=100");
  });

  test("should ignore numeric tags less specific than the current tag", async () => {
    const tagBody = { name: "library/alpine", tags: ["3.20", "3.21.1", "20260127"] };
    const provider = new DockerProvider({ fetch: mockFetch([Response.json(tagBody)]).fetch });

    await expect(provider.getLatestVersion("alpine", "3.19")).resolves.toBe("3.21.1");
  });

  test("should fail safely for unsupported or ambiguous tag resolution", async () => {
    const provider = new DockerProvider({ fetch: mockFetch([]).fetch });

    await expect(
      provider.getLatestVersion("registry.example.com/acme/widget", "1.0"),
    ).rejects.toThrow("Unsupported Docker registry");
    await expect(provider.getLatestVersion("node", "latest")).rejects.toThrow(
      "cannot safely resolve mutable tag",
    );
    await expect(provider.getLatestVersion("node")).rejects.toThrow("requires a current tag");
  });

  test("should report missing images and registry rate limits", async () => {
    const missingFetch = mockFetch([responseWithStatus(404)]).fetch;
    const limitedFetch = mockFetch([responseWithStatus(429)]).fetch;
    const missing = new DockerProvider({ fetch: missingFetch });
    const limited = new DockerProvider({ fetch: limitedFetch });

    await expect(missing.getAllVersions("missing/image")).rejects.toThrow(
      "Docker image not found: missing/image",
    );
    await expect(limited.getAllVersions("node")).rejects.toThrow(
      "Docker registry rate limit exceeded for node",
    );
  });

  test("should reject untrusted authentication and pagination URLs", async () => {
    const scope = "repository:library/node:pull";
    const challenge = bearerChallenge("https://evil.example/token", "registry.docker.io", scope);
    const challengeHeaders = { "WWW-Authenticate": challenge };
    const unauthorizedInit = { status: 401, headers: challengeHeaders };
    const unauthorized = new Response(null, unauthorizedInit);
    const authProvider = new DockerProvider({ fetch: mockFetch([unauthorized]).fetch });
    const link = '<https://evil.example/tags>; rel="next"';
    const paginationHeaders = { Link: link };
    const paginationBody = { name: "library/node", tags: ["20-slim"] };
    const paginationResponse = Response.json(paginationBody, { headers: paginationHeaders });
    const paginationFetch = mockFetch([paginationResponse]).fetch;
    const paginationProvider = new DockerProvider({ fetch: paginationFetch });

    await expect(authProvider.getAllVersions("node")).rejects.toThrow(
      "Untrusted Docker authentication URL",
    );
    await expect(paginationProvider.getAllVersions("node")).rejects.toThrow(
      "Untrusted Docker pagination URL",
    );
  });

  test("should report invalid registry responses without exposing credentials", async () => {
    const errorWithText = new Response(null, { status: 500, statusText: "Registry unavailable" });
    const errorWithoutText = responseWithStatus(500);
    const withText = new DockerProvider({ fetch: mockFetch([errorWithText]).fetch });
    const withoutText = new DockerProvider({ fetch: mockFetch([errorWithoutText]).fetch });
    const invalidTagsResponse = Response.json({ tags: null });
    const invalidTags = new DockerProvider({ fetch: mockFetch([invalidTagsResponse]).fetch });
    const malformedTags = new DockerProvider({ fetch: mockFetch([new Response("invalid")]).fetch });
    const networkFailure = new DockerProvider({ fetch: mockFetch([]).fetch });
    const tagBody = { tags: ["latest", "24-alpine"] };
    const incompatible = new DockerProvider({ fetch: mockFetch([Response.json(tagBody)]).fetch });

    await expect(withText.getAllVersions("node")).rejects.toThrow("500 Registry unavailable");
    await expect(withoutText.getAllVersions("node")).rejects.toThrow("failed for node: 500");
    await expect(invalidTags.getAllVersions("node")).rejects.toThrow("returned invalid tags");
    await expect(malformedTags.getAllVersions("node")).rejects.toThrow("invalid tags JSON");
    await expect(networkFailure.getAllVersions("node")).rejects.toThrow(
      "Docker registry network request failed for node",
    );
    await expect(incompatible.getLatestVersion("node", "20-slim")).rejects.toThrow(
      "No compatible Docker tags found",
    );
  });

  test("should reject incomplete credentials and invalid authentication responses", async () => {
    const scope = "repository:library/node:pull";
    const challenge = bearerChallenge("https://auth.docker.io/token", "registry.docker.io", scope);
    const unauthorizedHeaders = { "WWW-Authenticate": challenge };
    const unauthorizedInit = { status: 401, headers: unauthorizedHeaders };
    const incompleteFetch = mockFetch([new Response(null, unauthorizedInit)]).fetch;
    const invalidFetchResponses = [new Response(null, unauthorizedInit), Response.json({})];
    const incompleteCredentials = { username: "octocat" };
    const incomplete = new DockerProvider({
      fetch: incompleteFetch,
      dockerHubCredentials: incompleteCredentials,
    });
    const invalid = new DockerProvider({ fetch: mockFetch(invalidFetchResponses).fetch });

    await expect(incomplete.getAllVersions("node")).rejects.toThrow(
      "credentials require both username and token",
    );
    await expect(invalid.getAllVersions("node")).rejects.toThrow(
      "authentication response did not include a token",
    );
  });

  test("should read Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
ARG ALPINE_VERSION=3.19
FROM alpine:\${ALPINE_VERSION}
FROM debian:\${DEBIAN_VERSION}
FROM alpine@sha256:abc123
FROM scratch
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    const manifest = provider.readManifest(dockerfilePath);

    expect(manifest.dependencies).toEqual({
      node: "20.11.1",
      nginx: "1.25",
      alpine: "3.19",
    });
    expect(manifest.dependencyVersions).toEqual({
      node: ["20.11.1"],
      nginx: ["1.25"],
      alpine: ["3.19"],
    });
  });

  test("should update Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
ARG ALPINE_VERSION=3.19
FROM alpine:\${ALPINE_VERSION}
FROM debian:\${DEBIAN_VERSION}
FROM alpine@sha256:abc123
FROM scratch
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: {
        node: "22.0.0",
        nginx: "1.27",
        alpine: "3.20",
        scratch: "latest",
      },
    });

    const updated = readFileSync(dockerfilePath, "utf8");

    expect(updated).toContain("FROM node:22.0.0 AS build");
    expect(updated).toContain("FROM --platform=linux/amd64 nginx:1.27");
    expect(updated).toContain("ARG ALPINE_VERSION=3.20");
    expect(updated).toContain("FROM alpine:${ALPINE_VERSION}");
    expect(updated).toContain("FROM debian:${DEBIAN_VERSION}");
    expect(updated).toContain("FROM alpine@sha256:abc123");
    expect(updated).toContain("FROM scratch");
  });

  test("should preserve ARG formatting and static tag suffixes", () => {
    const content = `ARG NODE_VERSION = "20.11.1" # shared runtime
FROM node:\${NODE_VERSION}-slim AS build
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    const manifest = provider.readManifest(dockerfilePath);
    expect(manifest.dependencies).toEqual({ node: "20.11.1-slim" });

    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: { node: "24.0.0-slim" },
    });

    const updated = readFileSync(dockerfilePath, "utf8");
    expect(updated).toContain('ARG NODE_VERSION = "24.0.0" # shared runtime');
    expect(updated).toContain("FROM node:${NODE_VERSION}-slim AS build");
  });
});
