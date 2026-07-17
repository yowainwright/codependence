const NODE_ALPINE_DIGEST = [
  "fb71d01345f11b70",
  "8a3553c66e7c7407",
  "4f2d506400ea8197",
  "3343d915cb64eef0",
].join("");
const NODE_SLIM_DIGEST = [
  "2c87ef9bd3c6a3bd",
  "4b472b4bec2ce9d1",
  "6354b0c574f736c4",
  "76489d09f560a203",
].join("");

export const BUN_LINUX_AARCH64_SHA256 = [
  "a27ffb63a8310375",
  "836e0d6f668ae17f",
  "a8d8d18b88c37c82",
  "1c65331973a19a3b",
].join("");
export const BUN_LINUX_X64_SHA256 = [
  "951ee2aee855f085",
  "95aeec6225226a29",
  "8d3fea83a3dcd646",
  "5c09cbccdf7e848f",
].join("");

export const MISE_TOML = `
[tools]
bun = "1.3.14"
node = "24"
`;
export const NODE_ALPINE_IMAGE = `node:24-alpine@sha256:${NODE_ALPINE_DIGEST}`;
export const NODE_SLIM_IMAGE = `node:24-slim@sha256:${NODE_SLIM_DIGEST}`;

export const DOCKER_PINS = {
  bunArchives: {
    "1.3.14": {
      "linux-aarch64": BUN_LINUX_AARCH64_SHA256,
      "linux-x64": BUN_LINUX_X64_SHA256,
    },
  },
};
