const NODE_ALPINE_DIGEST = [
  "aadf416b2cdce311",
  "a8811ba3f0608a61",
  "b77dbf997500e2ea",
  "fe781b51f6a0b019",
].join("");
const NODE_SLIM_DIGEST = [
  "4ebb5ace66f15a24",
  "c14c492e01a8beee",
  "d4fddf970a856109",
  "f5126e703e5fe503",
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
node = "26.7.0"
`;
export const NODE_ALPINE_IMAGE = `node:26-alpine@sha256:${NODE_ALPINE_DIGEST}`;
export const NODE_SLIM_IMAGE = `node:26-slim@sha256:${NODE_SLIM_DIGEST}`;

export const DOCKER_PINS = {
  bunArchives: {
    "1.3.14": {
      "linux-aarch64": BUN_LINUX_AARCH64_SHA256,
      "linux-x64": BUN_LINUX_X64_SHA256,
    },
  },
};
