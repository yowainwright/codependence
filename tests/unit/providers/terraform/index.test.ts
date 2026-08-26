import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { TerraformProvider } from "../../../../src/providers/terraform";

describe("TerraformProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-terraform-test");
  const stackDir = join(tmpDir, "platform");
  const manifestPath = join(stackDir, "main.tf");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(stackDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new TerraformProvider();

    assert.strictEqual(provider.language, "terraform");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "semver",
    });
    assert.strictEqual(provider.validatePackageName("hashicorp/aws"), true);
    assert.strictEqual(provider.validatePackageName(" hashicorp/aws"), false);
    assert.strictEqual(provider.validatePackageName("{{ provider }}"), false);
    await assert.rejects(() => provider.getLatestVersion("hashicorp/aws"), /Terraform provider/);
    await assert.rejects(() => provider.getAllVersions("hashicorp/aws"), /Terraform provider/);
  });

  test("should read required providers and versioned module sources", () => {
    const content = `terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.30"
    }
  }
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"
}

module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.3"
}

module "local" {
  source = "./modules/local"
}
`;
    writeFileSync(manifestPath, content);
    const provider = new TerraformProvider();

    assert.deepStrictEqual(provider.readManifest(manifestPath), {
      filePath: manifestPath,
      name: "platform",
      dependencies: {
        "github.com/acme/app": "v1.2.3",
        "hashicorp/aws": "~> 5.30",
        "terraform-aws-modules/vpc/aws": "5.8.1",
      },
      dependencyVersions: {
        "github.com/acme/app": ["v1.2.3"],
        "hashicorp/aws": ["~> 5.30"],
        "terraform-aws-modules/vpc/aws": ["5.8.1"],
      },
    });
  });

  test("should update provider constraints and module refs", () => {
    const content = `terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.30" # provider
    }
  }
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.8.1" # module
}

module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.3" # git module
}
`;
    writeFileSync(manifestPath, content);
    const provider = new TerraformProvider();

    provider.writeManifest(manifestPath, {
      filePath: manifestPath,
      dependencies: {
        "github.com/acme/app": "v1.2.4",
        "hashicorp/aws": "~> 5.31",
        "terraform-aws-modules/vpc/aws": "5.9.0",
      },
    });

    assert.strictEqual(
      readFileSync(manifestPath, "utf8"),
      `terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.31" # provider
    }
  }
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.9.0" # module
}

module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.4" # git module
}
`,
    );
  });

  test("should ignore local, templated, and unversioned modules", () => {
    const content = `terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "{{ var.aws_version }}"
    }
  }
}

module "local" {
  source = "../modules/local"
}

module "unversioned" {
  source = "terraform-aws-modules/vpc/aws"
  description = "not a dependency field"
}

module "safe" {
  source = "git::https://github.com/acme/service.git?ref=v1.0.0"
}
`;
    writeFileSync(manifestPath, content);
    const provider = new TerraformProvider();

    assert.deepStrictEqual(provider.readManifest(manifestPath), {
      filePath: manifestPath,
      name: "platform",
      dependencies: {
        "github.com/acme/service": "v1.0.0",
      },
      dependencyVersions: {
        "github.com/acme/service": ["v1.0.0"],
      },
    });
  });

  test("should keep Terraform versions when no matching dependency exists", () => {
    const content = `module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.3"
}
`;
    writeFileSync(manifestPath, content);
    const provider = new TerraformProvider();

    provider.writeManifest(manifestPath, {
      filePath: manifestPath,
      dependencies: {},
    });

    assert.strictEqual(readFileSync(manifestPath, "utf8"), content);
  });
});
