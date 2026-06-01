import { readFileSync } from "fs";
import { extname } from "path";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class ConfigLoadError extends Error {
  constructor(
    filepath: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`Failed to load config ${filepath}: ${message}`);
    this.name = "ConfigLoadError";
  }
}

export const parseJSON = (content: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const stripYamlComment = (value: string): string => {
  let quote: string | null = null;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previous = value[index - 1];

    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? null : quote || char;
    }

    const isCommentStart = char === "#" && quote === null;
    const isSeparated = index === 0 || /\s/.test(previous);
    if (isCommentStart && isSeparated) return value.slice(0, index).trimEnd();
  }

  return value;
};

const splitInlineYamlArray = (value: string): string[] => {
  const items: string[] = [];
  let quote: string | null = null;
  let depth = 0;
  let current = "";

  for (const char of value) {
    if (char === "\"" || char === "'") {
      quote = quote === char ? null : quote || char;
    }

    if (quote === null && (char === "{" || char === "[")) depth++;
    if (quote === null && (char === "}" || char === "]")) depth--;

    if (char === "," && quote === null && depth === 0) {
      items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) items.push(current.trim());
  return items;
};

const findYamlSeparator = (value: string): number => {
  let quote: string | null = null;
  let depth = 0;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previous = value[index - 1];

    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? null : quote || char;
    }

    if (quote === null && (char === "{" || char === "[")) depth++;
    if (quote === null && (char === "}" || char === "]")) depth--;
    if (char === ":" && quote === null && depth === 0) return index;
  }

  return -1;
};

const parseYamlScalar = (rawValue: string): unknown => {
  const value = stripYamlComment(rawValue).trim();

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;

  const isQuoted =
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (isQuoted) return value.slice(1, -1);

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitInlineYamlArray(inner).map(parseYamlValue);
  }

  if (value.startsWith("{") && value.endsWith("}")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return {};

    return splitInlineYamlArray(inner).reduce<Record<string, unknown> | null>(
      (acc, pair) => {
        if (!acc) return null;

        const separatorIndex = findYamlSeparator(pair);
        if (separatorIndex < 0) return null;

        const key = parseYamlScalar(pair.slice(0, separatorIndex));
        if (typeof key !== "string") return null;

        return {
          ...acc,
          [key]: parseYamlValue(pair.slice(separatorIndex + 1)),
        };
      },
      {},
    );
  }

  return value;
};

const parseYamlValue = (rawValue: string): unknown => parseYamlScalar(rawValue);

const parseYamlArrayItem = (rawValue: string): unknown => {
  const value = stripYamlComment(rawValue).trim();
  const separatorIndex = findYamlSeparator(value);

  if (separatorIndex > -1) {
    const key = parseYamlScalar(value.slice(0, separatorIndex));
    if (typeof key !== "string") return null;
    return { [key]: parseYamlValue(value.slice(separatorIndex + 1)) };
  }

  return parseYamlValue(value);
};

export const parseYAML = (content: string): Record<string, unknown> | null => {
  if (!content.trim()) return null;

  const config: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const indent = line.match(/^\s*/)?.[0].length || 0;
    const trimmed = line.trim();

    if (indent === 0) {
      const separatorIndex = findYamlSeparator(trimmed);
      if (separatorIndex < 0) return null;

      const key = parseYamlScalar(trimmed.slice(0, separatorIndex));
      if (typeof key !== "string") return null;

      const value = trimmed.slice(separatorIndex + 1).trim();
      if (value === "") {
        config[key] = [];
        currentArrayKey = key;
      } else {
        config[key] = parseYamlValue(value);
        currentArrayKey = null;
      }
      continue;
    }

    if (!currentArrayKey || !trimmed.startsWith("- ")) return null;

    const currentValue = config[currentArrayKey];
    if (!Array.isArray(currentValue)) return null;

    currentValue.push(parseYamlArrayItem(trimmed.slice(2)));
  }

  return Object.keys(config).length > 0 ? config : null;
};

export const loadPackageJson = (
  filepath: string,
): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  const json = parseJSON(content);
  if (!json) {
    throw new ConfigLoadError(filepath, "package.json is not valid JSON");
  }

  const codependenceConfig = json.codependence;
  if (!codependenceConfig || typeof codependenceConfig !== "object") {
    return null;
  }

  return codependenceConfig as Record<string, unknown>;
};

export const loadRcFile = (filepath: string): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  const extension = extname(filepath);

  const config =
    extension === ".yaml" || extension === ".yml"
      ? parseYAML(content)
      : parseJSON(content) || parseYAML(content);

  if (!config) {
    throw new ConfigLoadError(
      filepath,
      "file is empty, invalid, or did not export an object",
    );
  }

  return config;
};
