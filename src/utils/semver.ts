import type { Level } from "../types";
import type { VersionStrategy } from "../providers/types";
import {
  REPEATING_VERSION_PREFIXES,
  VERSION_COMPARISON_PREFIXES,
} from "./constants";

export const stripRepeatingVersionPrefixes = (version: string): string => {
  let index = 0;
  while (REPEATING_VERSION_PREFIXES.includes(version[index] as "^" | "~")) {
    index++;
  }
  return version.slice(index);
};

const stripVersionPrefix = (version: string): string => {
  const comparisonPrefix = VERSION_COMPARISON_PREFIXES.find((prefix) =>
    version.startsWith(prefix),
  );
  if (comparisonPrefix) return version.slice(comparisonPrefix.length);

  const withoutRepeatingPrefixes = stripRepeatingVersionPrefixes(version);
  if (withoutRepeatingPrefixes !== version) return withoutRepeatingPrefixes;

  return version.startsWith("v") ? version.slice(1) : version;
};

export const parseSemver = (
  version: string,
): [number, number, number] => {
  const cleaned = stripVersionPrefix(version);
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
