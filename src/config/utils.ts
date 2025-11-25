import { readFileSync } from "fs";

export const parseJSON = (content: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

export const loadPackageJson = (
  filepath: string,
): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  const json = parseJSON(content);
  if (!json) return null;

  const codependenceConfig = json.codependence;
  if (!codependenceConfig || typeof codependenceConfig !== "object") {
    return null;
  }

  return codependenceConfig as Record<string, unknown>;
};

export const loadRcFile = (filepath: string): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  return parseJSON(content);
};
