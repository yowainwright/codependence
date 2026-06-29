import type { Level } from "../types";
import type { VersionStrategy } from "../providers/types";
import { VERSION_PREFIX_PATTERN } from "./constants";

export const parseSemver = (
  version: string,
): [number, number, number] => {
  const cleaned = version.replace(VERSION_PREFIX_PATTERN, "");
  const parts = cleaned.split(".").map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

export const isWithinLevel = (
  current: string,
  latest: string,
  level: Level,
  versionStrategy: VersionStrategy = "semver",
): boolean => {
  if (versionStrategy === "exact") return true;
  if (level === "major") return true;

  const [curMajor, curMinor] = parseSemver(current);
  const [latMajor, latMinor] = parseSemver(latest);

  if (level === "minor") return curMajor === latMajor;

  return curMajor === latMajor && curMinor === latMinor;
};
