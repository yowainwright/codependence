import { readFileSync } from "fs";

export const parseJSON = (content: string, filepath?: string): Record<string, unknown> | null => {
  const isEmpty = content.trim().length === 0;
  if (isEmpty) return null;

  try {
    return JSON.parse(content);
  } catch (err) {
    const location = filepath ? ` in ${filepath}` : "";
    throw new Error(`Invalid JSON${location}: ${(err as Error).message}`);
  }
};

export const loadPackageJson = (
  filepath: string,
): Record<string, unknown> | null => {
  try {
    const content = readFileSync(filepath, "utf8");
    const json = parseJSON(content, filepath);
    if (!json) return null;

    const codependenceConfig = json.codependence;
    const hasConfig = codependenceConfig && typeof codependenceConfig === "object";
    if (!hasConfig) return null;

    return codependenceConfig as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};

export const loadRcFile = (filepath: string): Record<string, unknown> | null => {
  try {
    const content = readFileSync(filepath, "utf8");
    return parseJSON(content, filepath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};
