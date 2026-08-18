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

export const MISE_TOML = `
[tools]
node = "26.7.0"
nub = "0.7.5"
`;
export const NODE_ALPINE_IMAGE = `node:26-alpine@sha256:${NODE_ALPINE_DIGEST}`;
export const NODE_SLIM_IMAGE = `node:26-slim@sha256:${NODE_SLIM_DIGEST}`;
