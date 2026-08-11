import { describe, expect, test } from "bun:test";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
  parseOnboardingRepository,
  scanOnboardingRepository,
} from "../../../../src/cli/onboarding";
import type { OnboardingFetcher, OnboardingFetchResponse } from "../../../../src/cli/onboarding";

const packageFile = (path: string, value: Record<string, unknown>) => ({
  path,
  content: JSON.stringify(value),
});

const questionMark = String.fromCharCode(63);

const githubTree = {
  sha: "tree-sha",
  truncated: false,
  tree: [
    { path: "package.json", type: "blob" },
    { path: "pnpm-lock.yaml", type: "blob" },
    { path: "pnpm-workspace.yaml", type: "blob" },
    { path: "apps/web/package.json", type: "blob" },
    { path: "examples/demo/package.json", type: "blob" },
  ],
};

const githubFixtureBody = (url: string): unknown => {
  const request = new URL(url);
  const requestPath = `${request.pathname}${request.search}`;
  if (requestPath === "/repos/acme/workspace") return { default_branch: "main" };
  if (requestPath.endsWith("/git/trees/main?recursive=1")) return githubTree;
  if (requestPath.endsWith("/main/package.json")) {
    return JSON.stringify({ packageManager: "pnpm@9.15.0" });
  }
  if (requestPath.endsWith("/main/pnpm-workspace.yaml")) return "packages:\n  - apps/*\n";
  if (requestPath.endsWith("/main/apps/web/package.json")) {
    return JSON.stringify({ dependencies: { react: "^19.0.0" } });
  }
  if (requestPath.endsWith("/main/examples/demo/package.json")) {
    return JSON.stringify({ dependencies: { lodash: "^4.17.21" } });
  }
  return undefined;
};

const githubFixtureResponse = (body: unknown): OnboardingFetchResponse => {
  const ok = body !== undefined;
  const status = ok ? 200 : 404;
  const content = typeof body === "string" ? body : JSON.stringify(body) || "";
  const json = () => Promise.resolve(body);
  const text = () => Promise.resolve(content);
  return { ok, status, json, text };
};

const githubFixtureFetcher: OnboardingFetcher = (url) => {
  const body = githubFixtureBody(url);
  return Promise.resolve(githubFixtureResponse(body));
};

describe("onboarding", () => {
  test("scans only the root and declared workspace packages", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        name: "workspace",
        packageManager: "pnpm@9.15.0",
        dependencies: { react: "^19.0.0" },
      }),
      packageFile("apps/web/package.json", {
        name: "@workspace/web",
        dependencies: { react: "^19.0.0", vite: "^8.1.0" },
      }),
      packageFile("packages/ui/package.json", {
        name: "@workspace/ui",
        peerDependencies: { react: "^18.3.1" },
      }),
      packageFile("examples/demo/package.json", {
        name: "demo",
        dependencies: { lodash: "^4.17.21" },
      }),
      { path: "fixtures/broken/package.json", content: "{" },
      packageFile("node_modules/fixture/package.json", {
        name: "fixture",
        dependencies: { chalk: "^5.0.0" },
      }),
      { path: "pnpm-lock.yaml", content: "" },
      {
        path: "pnpm-workspace.yaml",
        content: "packages:\n  - apps/*\n  - packages/*\n",
      },
    ]);

    expect(project.manager).toBe("pnpm");
    expect(project.managerVersion).toBe("9.15.0");
    expect(project.manifests.map(({ path }) => path)).toEqual([
      "package.json",
      "apps/web/package.json",
      "packages/ui/package.json",
    ]);
    expect(project.dependencies.map(({ name }) => name)).toEqual(["react", "vite"]);
    expect(project.dependencies[0].usages).toEqual([
      { path: "package.json", range: "^19.0.0", sections: ["dependencies"] },
      { path: "apps/web/package.json", range: "^19.0.0", sections: ["dependencies"] },
      { path: "packages/ui/package.json", range: "^18.3.1", sections: ["peerDependencies"] },
    ]);
  });

  test("treats regex question marks as literal workspace path characters", () => {
    const workspacePath = `packages/ui${questionMark}kit`;
    const manifestPath = `${workspacePath}/package.json`;
    const project = analyzeOnboardingProject([
      packageFile("package.json", { workspaces: [workspacePath] }),
      packageFile(manifestPath, { dependencies: { react: "^19.0.0" } }),
      packageFile("packages/uikit/package.json", {
        dependencies: { lodash: "^4.17.21" },
      }),
    ]);

    expect(project.manifests.map(({ path }) => path)).toEqual(["package.json", manifestPath]);
    expect(project.dependencies.map(({ name }) => name)).toEqual(["react"]);
  });

  test("parses quoted pnpm workspace paths and exclusions", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {}),
      packageFile("apps/web/package.json", { dependencies: { react: "^19.0.0" } }),
      packageFile("packages/ui/package.json", { dependencies: { vite: "^8.1.0" } }),
      packageFile("packages/private/package.json", { dependencies: { lodash: "^4.17.21" } }),
      {
        path: "pnpm-workspace.yaml",
        content: [
          "packages:",
          "  - 'apps/*' # applications",
          '  - "packages/*"',
          "  - '!packages/private'",
          "catalog:",
          "  react: ^19.0.0",
        ].join("\n"),
      },
    ]);

    expect(project.manifests.map(({ path }) => path)).toEqual([
      "package.json",
      "apps/web/package.json",
      "packages/ui/package.json",
    ]);
  });

  test("generates one project policy and the selected enforcement artifacts", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        name: "workspace",
        packageManager: "pnpm@9.15.0",
        workspaces: ["apps/*"],
        dependencies: { react: "^19.0.0" },
      }),
      packageFile("apps/web/package.json", {
        name: "@workspace/web",
        dependencies: { react: "^19.0.0", vite: "^8.1.0" },
      }),
      { path: "pnpm-lock.yaml", content: "" },
    ]);
    const setup = createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: ["react"],
      enforcement: "both",
      repository: { owner: "acme", name: "workspace" },
    });

    expect(setup.artifacts.map(({ path }) => path)).toEqual([
      ".codependencerc",
      ".github/workflows/codependence-node.yml",
    ]);
    expect(JSON.parse(setup.artifacts[0].content)).toEqual({
      targets: [
        {
          manager: "pnpm",
          files: ["package.json", "apps/web/package.json"],
          mode: "precise",
          codependencies: ["react"],
        },
      ],
    });
    expect(setup.artifacts[1].content).toContain("targets: pnpm");
    expect(setup.artifacts[1].content).toContain("version: 9.15.0");
    expect(setup.artifacts[1].content).toContain("secrets.CODEPENDENCE_TOKEN");
    expect(setup.artifacts[1].content).toContain("post-update-command: 'pnpm install'");
    expect(setup.installCommand).toBe("pnpm add --save-dev -w codependence");
    expect(setup.verifyCommand).toBe("pnpm exec codependence");
    expect(setup.tokenSetup?.repositorySecretUrl).toBe(
      "https://github.com/acme/workspace/settings/secrets/actions/new",
    );
  });

  test("rejects inexact package manager versions for GitHub Actions", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        packageManager: "npm@latest",
        dependencies: { react: "^19.0.0" },
      }),
    ]);
    const createSetup = () =>
      createOnboardingSetup(project, {
        mode: "precise",
        selectedDependencies: [],
        enforcement: "github",
        repository: { owner: "acme", name: "web" },
      });

    expect(createSetup).toThrow("npm requires an exact package manager version");
  });

  test("omits GitHub workflow and token setup for local onboarding", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        dependencies: { react: "^19.0.0" },
      }),
      { path: "package-lock.json", content: "" },
    ]);
    const setup = createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: [],
      enforcement: "local",
    });

    expect(setup.artifacts.map(({ path }) => path)).toEqual([".codependencerc"]);
    expect(setup.tokenSetup).toBeUndefined();
  });

  test("uses an explicit Yarn workspace-root install", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        packageManager: "yarn@1.22.22",
        workspaces: ["packages/*"],
      }),
      packageFile("packages/ui/package.json", {
        dependencies: { react: "^19.0.0" },
      }),
      { path: "yarn.lock", content: "" },
    ]);
    const setup = createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: [],
      enforcement: "local",
    });

    expect(setup.installCommand).toBe("yarn add --dev -W codependence");
  });

  test("scans a public GitHub repository", async () => {
    const repository = parseOnboardingRepository("https://github.com/acme/workspace");
    const project = await scanOnboardingRepository(repository, githubFixtureFetcher);

    expect(project.manifests.map(({ path }) => path)).toEqual([
      "package.json",
      "apps/web/package.json",
    ]);
    expect(project.dependencies.map(({ name }) => name)).toEqual(["react"]);
  });

  test("normalizes a trailing slash without accepting extra repository segments", () => {
    const repository = parseOnboardingRepository("https://github.com/acme/workspace/");

    expect(repository).toEqual({ owner: "acme", name: "workspace" });
    expect(() => parseOnboardingRepository("acme/workspace/issues")).toThrow(
      "Enter a GitHub repository as owner/name",
    );
  });
});
