export const TOOL_OUTPUT_KEYS = {
  bunLinuxAarch64Sha256: "bun_linux_aarch64_sha256",
  bunLinuxX64Sha256: "bun_linux_x64_sha256",
  bunVersion: "bun_version",
  nodeAlpineImage: "node_alpine_image",
  nodeSlimImage: "node_slim_image",
  nodeVersion: "node_version",
};

export const SUPPORTED_PRERELEASES = new Set(["alpha", "beta", "rc"]);
export const RELEASE_VERSION_PATTERN =
  /^v?\d+\.\d+\.\d+(?:-([0-9A-Za-z-]+)(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?$/;
