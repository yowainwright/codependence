import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { DockerProvider } from "../../../src/providers/docker";

describe("DockerProvider", () => {
  const tmpDir = join(__dirname, ".tmp-docker-test");
  const dockerfilePath = join(tmpDir, "Dockerfile");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new DockerProvider();

    expect(provider.language).toBe("docker");
    expect(await provider.getLatestVersion("node")).toBe("");
    expect(await provider.getAllVersions("node")).toEqual([]);
    expect(provider.validatePackageName("ghcr.io/org/image")).toBe(true);
    expect(provider.validatePackageName("bad image")).toBe(false);
  });

  test("should read Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
FROM scratch
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    const manifest = provider.readManifest(dockerfilePath);

    expect(manifest.dependencies).toEqual({
      node: "20.11.1",
      nginx: "1.25",
      scratch: "latest",
    });
  });

  test("should update Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
FROM alpine@sha256:abc123
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: {
        node: "22.0.0",
        nginx: "1.27",
        alpine: "3.20",
      },
    });

    const updated = readFileSync(dockerfilePath, "utf8");

    expect(updated).toContain("FROM node:22.0.0 AS build");
    expect(updated).toContain("FROM --platform=linux/amd64 nginx:1.27");
    expect(updated).toContain("FROM alpine@sha256:abc123");
  });
});
