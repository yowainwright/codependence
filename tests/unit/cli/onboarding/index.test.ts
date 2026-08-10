import { describe, expect, test } from "bun:test";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
} from "../../../../src/cli/onboarding";

const packageFile = (path: string, value: Record<string, unknown>) => ({
  path,
  content: JSON.stringify(value),
});

describe("onboarding", () => {
  test("scans only the root and declared workspace packages", () => {
    const project = analyzeOnboardingProject([
      packageFile("package.json", {
        name: "workspace",
        packageManager: "pnpm@9.15.0",
        workspaces: ["apps/*", "packages/*"],
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
      packageFile("node_modules/fixture/package.json", {
        name: "fixture",
        dependencies: { chalk: "^5.0.0" },
      }),
      { path: "pnpm-lock.yaml", content: "" },
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
    expect(setup.installCommand).toBe("pnpm add --save-dev codependence");
    expect(setup.verifyCommand).toBe("pnpm exec codependence");
    expect(setup.tokenSetup?.repositorySecretUrl).toBe(
      "https://github.com/acme/workspace/settings/secrets/actions/new",
    );
  });
});
