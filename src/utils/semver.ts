import type { Level } from "../types";

export const parseSemver = (
  version: string,
): [number, number, number] => {
  const match = version.match(/v?\d+(?:\.\d+){0,2}/);
  const cleaned = (match?.[0] || "").replace(/^v/, "");
  const parts = cleaned.split(".").map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

export const isWithinLevel = (
  current: string,
  latest: string,
  level: Level,
): boolean => {
  if (level === "major") return true;

  const [curMajor, curMinor] = parseSemver(current);
  const [latMajor, latMinor] = parseSemver(latest);

  if (level === "minor") return curMajor === latMajor;

  return curMajor === latMajor && curMinor === latMinor;
};
