import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertRejects, assertThrows } from "../../../helpers/assertions";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
  isOnboardingSourcePath,
  onboardingSourceFileNeedsContent,
  parseOnboardingRepository,
  scanOnboardingRepository,
} from "../../../../src/cli/init";
import { onboardingFilename } from "../../../../src/cli/init/utils";
import { validateConfig } from "../../../../src/config";
import type { OnboardingFetcher, OnboardingFetchResponse } from "../../../../src/cli/init";

const configuresSupportedManifestsWithoutPackageJsonExpected = [
  { path: "services/api/go.mod", content: "module example.com/api\n" },
  { path: "crates/core/Cargo.toml", content: '[package]\nname = "core"\n' },
  { path: "python/pyproject.toml", content: '[tool.poetry]\nname = "api"\n' },
  { path: "Dockerfile", content: "FROM node:26\n" },
  { path: ".github/workflows/check.yml", content: "name: Check\n" },
];

const generatesOneProjectPolicyAndTheSelectedEnforcementExpected = {
  name: "workspace",
  packageManager: "pnpm@9.15.0",
  workspaces: ["apps/*"],
  dependencies: { react: "^19.0.0" },
};

const packageFile = (path: string, value: Record<string, unknown>) => ({
  path,
  content: JSON.stringify(value),
});

const questionMark = String.fromCharCode(63);

const ecosystemManifests = [
  {
    path: "requirements.txt",
    manager: "pip",
    dependency: "requests",
    content: "requests==2.32.0\n",
  },
  {
    path: "Pipfile",
    manager: "pipenv",
    dependency: "requests",
    content: '[packages]\nrequests = "==2.32.0"\n',
  },
  {
    path: "pyproject.toml",
    manager: "poetry",
    dependency: "requests",
    content: '[tool.poetry.dependencies]\nrequests = "2.32.0"\n',
  },
  {
    path: "environment.yml",
    manager: "conda",
    dependency: "numpy",
    content: "dependencies:\n  - numpy=1.26.0\n",
  },
  {
    path: "go.mod",
    manager: "go",
    dependency: "example.com/lib",
    content: "module example.com/api\nrequire example.com/lib v1.2.3\n",
  },
  {
    path: "Cargo.toml",
    manager: "rust",
    dependency: "serde",
    content: '[dependencies]\nserde = "1.0.210"\n',
  },
  { path: "Dockerfile", manager: "docker", dependency: "node", content: "FROM node:24-slim\n" },
  {
    path: ".github/workflows/ci.yml",
    manager: "github-actions",
    dependency: "actions/checkout",
    content: "steps:\n  - uses: actions/checkout@v5\n",
  },
  {
    path: ".circleci/config.yml",
    manager: "circleci",
    dependency: "circleci/node",
    content: "orbs:\n  node: circleci/node@7.2.0\n",
  },
  {
    path: "charts/api/Chart.yaml",
    manager: "helm",
    dependency: "redis",
    content:
      "apiVersion: v2\nname: api\ndependencies:\n  - name: redis\n    version: 20.6.3\n    repository: https://charts.bitnami.com/bitnami\n",
  },
  {
    path: "k8s/app.yaml",
    manager: "kubernetes",
    dependency: "nginx",
    content: "image: nginx:1.27\n",
  },
  {
    path: "overlays/prod/kustomization.yaml",
    manager: "kustomize",
    dependency: "alpine",
    content: "images:\n  - name: alpine\n    newTag: 3.19\n",
  },
  {
    path: "infra/main.tf",
    manager: "terraform",
    dependency: "hashicorp/aws",
    content:
      'terraform {\n  required_providers {\n    aws = {\n      source = "hashicorp/aws"\n      version = "~> 5.30"\n    }\n  }\n}\n',
  },
];

ecosystemManifests.forEach(({ path, content, manager, dependency }) => {
  test(`scans ${manager} dependencies and generates a valid policy`, () => {
    assert.strictEqual(isOnboardingSourcePath(path), true);
    assert.strictEqual(onboardingSourceFileNeedsContent(path), true);
    const project = analyzeOnboardingProject([{ path, content }]);
    assert.strictEqual(project.manifests[0].manager, manager);
    assert.ok(project.dependencies.some(({ name }) => name === dependency));
    const setup = createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: [],
      enforcement: "local",
    });
    const config = JSON.parse(setup.artifacts[0].content);
    assert.deepStrictEqual(validateConfig(config).errors, []);
  });
});

test("selects supported browser onboarding files", () => {
  const paths = [
    "package.json",
    "services/api/go.mod",
    "crates/core/Cargo.toml",
    "python/pyproject.toml",
    "containers/Dockerfile.dev",
    "services/api/.github/workflows/update.yaml",
    ".circleci/config.yml",
    "charts/api/Chart.yaml",
    "charts/api/values.yaml",
    "k8s/deployment.yaml",
    "kubernetes/deployment.yml",
    "manifests/deployment.yaml",
    "overlays/prod/kustomization.yaml",
    "infra/main.tf",
  ];

  assert.strictEqual(paths.every(isOnboardingSourcePath), true);
  assert.strictEqual(isOnboardingSourcePath("node_modules/pkg/package.json"), false);
  assert.strictEqual(isOnboardingSourcePath("README.md"), false);
  assert.strictEqual(onboardingSourceFileNeedsContent("python/pyproject.toml"), true);
  assert.strictEqual(onboardingSourceFileNeedsContent(".github/workflows/update.yml"), true);
  assert.strictEqual(onboardingSourceFileNeedsContent("services/api/go.mod"), true);
  assert.strictEqual(onboardingFilename(""), "");
});

const githubTree = {
  sha: "tree-sha",
  truncated: false,
  tree: [
    { path: "package.json", type: "blob" },
    { path: "pnpm-lock.yaml", type: "blob" },
    { path: "pnpm-workspace.yaml", type: "blob" },
    { path: "apps/web/package.json", type: "blob" },
    { path: "examples/demo/package.json", type: "blob" },
    { path: "services/api/go.mod", type: "blob" },
    { path: "python/pyproject.toml", type: "blob" },
    { path: ".github/workflows/codependence-go.yml", type: "blob" },
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
  if (requestPath.endsWith("/main/python/pyproject.toml")) return "[tool.poetry]\n";
  if (requestPath.endsWith("/main/services/api/go.mod")) return "module example.com/api\n";
  if (requestPath.endsWith("/main/.github/workflows/codependence-go.yml")) {
    return "# Generated by `codependence init actions`.\n";
  }
  return undefined;
};

const githubFixtureResponse = (body: unknown): OnboardingFetchResponse => {
  const ok = body !== undefined;
  const status = ok ? 200 : 404;
  const serializedBody = JSON.stringify(body);
  const fallbackContent = serializedBody || "";
  const content = typeof body === "string" ? body : fallbackContent;
  const json = () => Promise.resolve(body);
  const text = () => Promise.resolve(content);
  return { ok, status, json, text };
};

const githubFixtureFetcher: OnboardingFetcher = (url) => {
  const body = githubFixtureBody(url);
  return Promise.resolve(githubFixtureResponse(body));
};

const staticFetcher =
  (body: unknown): OnboardingFetcher =>
  () =>
    Promise.resolve(githubFixtureResponse(body));

test("collects non-Node dependency choices from manifest contents", () => {
  const project = analyzeOnboardingProject([
    { path: "requirements.txt", content: "requests==2.32.0\n" },
    { path: "go.mod", content: "module example.com/api\nrequire example.com/lib v1.2.3\n" },
    { path: "Cargo.toml", content: '[dependencies]\nserde = "1.0.210"\n' },
    { path: "Dockerfile", content: "FROM node:24-slim\n" },
    { path: ".github/workflows/ci.yml", content: "steps:\n  - uses: actions/checkout@v5\n" },
  ]);
  assert.deepStrictEqual(
    project.dependencies.map(({ name }) => name),
    ["actions/checkout", "example.com/lib", "node", "requests", "serde"],
  );
  const setup = createOnboardingSetup(project, {
    mode: "verbose",
    selectedDependencies: ["requests"],
    enforcement: "local",
  });
  const config = JSON.parse(setup.artifacts[0].content).config;
  assert.deepStrictEqual(config["requirements.txt"].codependencies, ["requests"]);
  assert.deepStrictEqual(config["go.mod"].codependencies, []);
});

test("keeps infrastructure onboarding policies within explicit-pin capabilities", () => {
  const project = analyzeOnboardingProject([
    { path: "k8s/app.yaml", content: "spec:\n  containers:\n    - image: nginx:1.27\n" },
  ]);
  const setup = createOnboardingSetup(project, {
    mode: "precise",
    selectedDependencies: [],
    enforcement: "local",
  });
  const policy = JSON.parse(setup.artifacts[0].content).config["k8s/app.yaml"];
  assert.strictEqual(policy.mode, "verbose");
  assert.deepStrictEqual(policy.codependencies, [{ nginx: "1.27" }]);
});

test("shows conflicting infrastructure pins and refuses to choose one silently", () => {
  const project = analyzeOnboardingProject([
    {
      path: "k8s/app.yaml",
      content: "containers:\n  - image: nginx:1.25\n  - image: nginx:1.27\n",
    },
  ]);
  assert.deepStrictEqual(
    project.dependencies[0].usages.map(({ range }) => range),
    ["1.25", "1.27"],
  );
  const createSetup = () =>
    createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: [],
      enforcement: "local",
    });
  assertThrows(createSetup, "Multiple versions of nginx in k8s/app.yaml");
});

test("omits unselected explicit-pin targets from a mixed update-only policy", () => {
  const project = analyzeOnboardingProject([
    packageFile("package.json", { dependencies: { react: "^19.0.0" } }),
    { path: "k8s/app.yaml", content: "image: nginx:1.27\n" },
  ]);
  const setup = createOnboardingSetup(project, {
    mode: "verbose",
    selectedDependencies: ["react"],
    enforcement: "local",
  });
  const config = JSON.parse(setup.artifacts[0].content);
  assert.deepStrictEqual(validateConfig(config).errors, []);
  assert.strictEqual(config.config["k8s/app.yaml"], undefined);
});

test("generates GitHub enforcement for an infrastructure-only project without a tool version", () => {
  const project = analyzeOnboardingProject([
    { path: "k8s/app.yaml", content: "image: nginx:1.27\n" },
  ]);
  const setup = createOnboardingSetup(project, {
    mode: "precise",
    selectedDependencies: [],
    enforcement: "github",
    repository: { owner: "acme", name: "infra" },
  });
  assert.strictEqual(setup.artifacts.length, 2);
  assert.match(setup.artifacts[1].content, /targets: kubernetes/);
  assert.doesNotMatch(setup.artifacts[1].content, /version:/);
});

test("generates one workflow covering Node and Go manifests with their exact tool versions", () => {
  const scanned = analyzeOnboardingProject([
    packageFile("package.json", { packageManager: "pnpm@9.15.0" }),
    { path: "services/api/go.mod", content: "module example.com/api\n" },
  ]);
  const project = { ...scanned, toolVersions: { go: "1.26.0" } };
  const setup = createOnboardingSetup(project, {
    mode: "precise",
    selectedDependencies: [],
    enforcement: "github",
    repository: { owner: "acme", name: "mixed" },
  });
  assert.strictEqual(setup.artifacts.length, 2);
  const workflow = setup.artifacts[1].content;
  assert.match(workflow, /targets: \|\n\s+pnpm\n\s+go/);
  assert.match(workflow, /pnpm=9\.15\.0/);
  assert.match(workflow, /go=1\.26\.0/);
  assert.match(workflow, /services\/api/);
  assert.match(workflow, /go mod tidy/);
});

test("generates Python workflows with native locking commands and manager versions", () => {
  const scanned = analyzeOnboardingProject([
    { path: "api/requirements.txt", content: "requests==2.32.0\n" },
    { path: "tools/Pipfile", content: '[packages]\nrequests = "==2.32.0"\n' },
    { path: "lib/pyproject.toml", content: '[tool.poetry.dependencies]\nrequests = "2.32.0"\n' },
    { path: "env/environment.yml", content: "dependencies:\n  - numpy=1.26.0\n" },
  ]);
  const toolVersions = { pip: "25.1.1", pipenv: "2025.0.4", poetry: "2.1.3", conda: "25.3.1" };
  const project = { ...scanned, toolVersions };
  const setup = createOnboardingSetup(project, {
    mode: "precise",
    selectedDependencies: [],
    enforcement: "github",
    repository: { owner: "acme", name: "python" },
  });
  const config = JSON.parse(setup.artifacts[0].content).config;
  assert.strictEqual(config["api/requirements.txt"].lockfile, false);
  assert.strictEqual(config["env/environment.yml"].lockfile, false);
  assert.match(setup.artifacts[1].content, /pip=25\.1\.1/);
  assert.match(setup.artifacts[1].content, /conda=25\.3\.1/);
  assert.match(setup.artifacts[1].content, /pipenv lock/);
  assert.match(setup.artifacts[1].content, /poetry lock/);
});

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("onboarding", () => {
  test("ignores workflows generated by init", () => {
    const project = analyzeOnboardingProject([
      { path: "go.mod", content: "module example.com/api\n" },
      {
        path: ".github/workflows/codependence-go.yml",
        content: "# Generated by `codependence init actions`.\nname: Codependence\n",
      },
    ]);

    assert.deepStrictEqual(project.manifests, [{ path: "go.mod", name: "go.mod", manager: "go" }]);
  });

  test("configures supported manifests without package.json", () => {
    const project = analyzeOnboardingProject(
      configuresSupportedManifestsWithoutPackageJsonExpected,
    );
    const setup = createOnboardingSetup(project, {
      mode: "precise",
      selectedDependencies: [],
      enforcement: "local",
    });
    const config = JSON.parse(setup.artifacts[0].content);

    assert.strictEqual(project.manager, undefined);
    assert.deepStrictEqual(config.config, {
      "services/api/go.mod": {
        path: "services/api/go.mod",
        manager: "go",
        mode: "precise",
      },
      "crates/core/Cargo.toml": {
        path: "crates/core/Cargo.toml",
        manager: "rust",
        mode: "precise",
      },
      "python/pyproject.toml": {
        path: "python/pyproject.toml",
        manager: "poetry",
        mode: "precise",
      },
      Dockerfile: { path: "Dockerfile", manager: "docker", mode: "precise" },
      ".github/workflows/check.yml": {
        path: ".github/workflows/check.yml",
        manager: "github-actions",
        mode: "precise",
      },
    });
    assert.strictEqual(setup.install, undefined);
    assert.strictEqual(setup.verifyCommand, "codependence");
  });

  test("detects supported Python manifests", () => {
    const project = analyzeOnboardingProject([
      { path: "requirements.txt", content: "requests==2.32.0\n" },
      { path: "pipenv/Pipfile", content: "[packages]\n" },
      { path: "conda/environment.yml", content: "dependencies: []\n" },
      { path: "uv/pyproject.toml", content: "[project]\n" },
      { path: "uv/uv.lock", content: "" },
      { path: "poetry/pyproject.toml", content: "[tool.poetry]\n" },
      { path: "pip/pyproject.toml", content: "[project]\n" },
      { path: "Dockerfile.dev", content: "FROM node:26\n" },
    ]);
    const managers = project.manifests.map(({ path, manager }) => ({ path, manager }));

    assert.deepStrictEqual(managers, [
      { path: "requirements.txt", manager: "pip" },
      { path: "pipenv/Pipfile", manager: "pipenv" },
      { path: "conda/environment.yml", manager: "conda" },
      { path: "uv/pyproject.toml", manager: "uv" },
      { path: "poetry/pyproject.toml", manager: "poetry" },
      { path: "pip/pyproject.toml", manager: "pip" },
      { path: "Dockerfile.dev", manager: "docker" },
    ]);
  });

  test("scans only the root and declared workspace packages", () => {
    const project = workspaceProject();

    assert.strictEqual(project.manager, "pnpm");
    assert.strictEqual(project.managerVersion, "9.15.0");
    assert.deepStrictEqual(
      project.manifests.map(({ path }) => path),
      ["package.json", "apps/web/package.json", "packages/ui/package.json"],
    );
    assert.deepStrictEqual(
      project.dependencies.map(({ name }) => name),
      ["react", "vite"],
    );
    assert.deepStrictEqual(project.dependencies[0].usages, [
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

    assert.deepStrictEqual(
      project.manifests.map(({ path }) => path),
      ["package.json", manifestPath],
    );
    assert.deepStrictEqual(
      project.dependencies.map(({ name }) => name),
      ["react"],
    );
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
          '  - "packages\\\\*"',
          "  - '!packages/private'",
          "catalog:",
          "  react: ^19.0.0",
        ].join("\n"),
      },
    ]);

    assert.deepStrictEqual(
      project.manifests.map(({ path }) => path),
      ["package.json", "apps/web/package.json", "packages/ui/package.json"],
    );
  });

  test("generates one project policy and the selected enforcement artifacts", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", generatesOneProjectPolicyAndTheSelectedEnforcementExpected),
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

    assert.deepStrictEqual(
      setup.artifacts.map(({ path }) => path),
      [".codependencerc", ".github/workflows/codependence-node.yml"],
    );
    assert.deepStrictEqual(JSON.parse(setup.artifacts[0].content), expectedWorkspacePolicy);
    assert.match(setup.artifacts[1].content, /targets: pnpm/);
    assert.match(setup.artifacts[1].content, /version: 9\.15\.0/);
    assert.match(setup.artifacts[1].content, /secrets\.CODEPENDENCE_TOKEN/);
    assert.match(setup.artifacts[1].content, /post-update-command: 'pnpm install'/);
    assert.strictEqual(setup.installCommand, "pnpm add --save-dev -w codependence");
    assert.strictEqual(setup.verifyCommand, "pnpm exec codependence");
    assert.strictEqual(
      setup.tokenSetup?.repositorySecretUrl,
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

    assertThrows(createSetup, "npm requires an exact package manager version");
  });

  test("requires a package manager version for GitHub Actions", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", { dependencies: { react: "^19.0.0" } }),
      { path: "package-lock.json", content: "" },
    ]);
    const createSetup = () =>
      createOnboardingSetup(project, {
        mode: "precise",
        selectedDependencies: [],
        enforcement: "github",
        repository: { owner: "acme", name: "web" },
      });

    assertThrows(createSetup, "packageManager must include an exact version");
  });

  test("requires a dependency in update-only mode", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", { dependencies: { react: "^19.0.0" } }),
      { path: "package-lock.json", content: "" },
    ]);
    const createSetup = () =>
      createOnboardingSetup(project, {
        mode: "verbose",
        selectedDependencies: [],
        enforcement: "local",
      });

    assertThrows(createSetup, "Update-only mode requires at least one dependency");
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

    assert.deepStrictEqual(
      setup.artifacts.map(({ path }) => path),
      [".codependencerc"],
    );
    assert.strictEqual(setup.tokenSetup, undefined);
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

    assert.strictEqual(setup.installCommand, "yarn add --dev -W codependence");
  });

  test("scans repository files through the injected fetcher", async () => {
    const repository = parseOnboardingRepository("https://github.com/acme/workspace");
    const project = await scanOnboardingRepository(repository, githubFixtureFetcher);

    assert.deepStrictEqual(
      project.manifests.map(({ path }) => path),
      ["package.json", "apps/web/package.json", "services/api/go.mod", "python/pyproject.toml"],
    );
    assert.deepStrictEqual(
      project.dependencies.map(({ name }) => name),
      ["react"],
    );
  });

  test("normalizes a trailing slash without accepting extra repository segments", () => {
    const repository = parseOnboardingRepository("https://github.com/acme/workspace/");

    assert.deepStrictEqual(repository, { owner: "acme", name: "workspace" });
    assertThrows(
      () => parseOnboardingRepository("acme/workspace/issues"),
      "Enter a GitHub repository as owner/name",
    );
  });

  test("wraps invalid local manifests", () => {
    assertThrows(
      () => analyzeOnboardingProject([{ path: "package.json", content: "{" }]),
      "package.json is not valid JSON",
    );
    assertThrows(
      () => analyzeOnboardingProject([{ path: "README.md", content: "" }]),
      "No supported package manifests found",
    );
  });

  test("rejects failed GitHub metadata and file requests", async () => {
    const repository = { owner: "acme", name: "missing" };
    const failedFetcher = staticFetcher(undefined);
    const fileFailureFetcher: OnboardingFetcher = (url) => {
      const isMetadata = url.endsWith("/repos/acme/missing");
      if (isMetadata) return Promise.resolve(githubFixtureResponse({ default_branch: "main" }));
      const isTree = url.includes("/git/trees/");
      if (isTree) {
        return Promise.resolve(
          githubFixtureResponse({
            truncated: false,
            tree: [{ path: "package.json", type: "blob" }],
          }),
        );
      }
      return Promise.resolve(githubFixtureResponse(undefined));
    };

    await assertRejects(
      scanOnboardingRepository(repository, failedFetcher),
      "GitHub request failed with status 404",
    );
    await assertRejects(
      scanOnboardingRepository(repository, fileFailureFetcher),
      "GitHub file request failed with status 404",
    );
  });

  test("rejects malformed GitHub repository responses", async () => {
    const repository = { owner: "acme", name: "workspace" };
    const invalidMetadata = staticFetcher({ default_branch: 42 });
    const invalidTreeEntry: OnboardingFetcher = (url) => {
      const body = url.includes("/git/trees/")
        ? { truncated: false, tree: [{ path: 42, type: "blob" }] }
        : { default_branch: "main" };
      return Promise.resolve(githubFixtureResponse(body));
    };
    const invalidTree =
      (value: unknown): OnboardingFetcher =>
      (url) => {
        const body = url.includes("/git/trees/") ? value : { default_branch: "main" };
        return Promise.resolve(githubFixtureResponse(body));
      };

    await assertRejects(
      scanOnboardingRepository(repository, invalidMetadata),
      "GitHub repository metadata is invalid",
    );
    await assertRejects(
      scanOnboardingRepository(repository, invalidTreeEntry),
      "GitHub repository tree is invalid",
    );
    await assertRejects(
      scanOnboardingRepository(repository, invalidTree({ truncated: "yes", tree: [] })),
      "GitHub repository tree is invalid",
    );
  });

  test("rejects truncated repository trees and malformed workspace lists", async () => {
    const repository = { owner: "acme", name: "workspace" };
    const truncatedFetcher: OnboardingFetcher = (url) => {
      const body = url.includes("/git/trees/")
        ? { truncated: true, tree: [] }
        : { default_branch: "main" };
      return Promise.resolve(githubFixtureResponse(body));
    };

    await assertRejects(
      scanOnboardingRepository(repository, truncatedFetcher),
      "GitHub repository tree is too large",
    );
    assertThrows(
      () =>
        analyzeOnboardingProject([
          packageFile("package.json", {}),
          { path: "pnpm-workspace.yaml", content: "packages: []" },
        ]),
      "pnpm-workspace.yaml packages must be a list of paths",
    );
    assertThrows(
      () =>
        analyzeOnboardingProject([
          packageFile("package.json", {}),
          { path: "pnpm-workspace.yaml", content: "packages:\n  invalid" },
        ]),
      "pnpm-workspace.yaml packages must be a list of paths",
    );
  });
});

function workspaceProject() {
  return analyzeOnboardingProject([
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
}

const expectedWorkspacePolicy = {
  config: {
    root: {
      name: "workspace",
      path: "package.json",
      manager: "pnpm",
      mode: "precise",
      codependencies: ["react"],
    },
    "apps/web": {
      name: "@workspace/web",
      path: "apps/web/package.json",
      manager: "pnpm",
      mode: "precise",
      codependencies: ["react"],
    },
  },
};
