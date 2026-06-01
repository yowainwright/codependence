import { readFileSync } from "fs";
import { extname } from "path";

type ParsedLine = {
  indent: number;
  text: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class ConfigLoadError extends Error {
  constructor(filepath: string, message: string) {
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

const stripComment = (line: string): string => {
  let quote: string | null = null;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const previous = line[index - 1];

    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? null : quote || char;
    }

    if (char === "#" && quote === null) {
      const isSeparated = index === 0 || /\s/.test(previous);
      if (isSeparated) return line.slice(0, index).trimEnd();
    }
  }

  return line;
};

const parseLines = (content: string): ParsedLine[] =>
  content
    .split(/\r?\n/)
    .map((line) => {
      const text = stripComment(line);
      return {
        indent: text.match(/^\s*/)?.[0].length || 0,
        text: text.trim(),
      };
    })
    .filter((line) => line.text.length > 0);

const unquote = (value: string): string => {
  const trimmed = value.trim();
  const quote = trimmed[0];
  const isQuoted =
    (quote === "\"" || quote === "'") && trimmed.endsWith(quote);

  if (!isQuoted) return trimmed;

  if (quote === "\"") {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed.slice(1, -1);
};

const findSeparator = (value: string): number => {
  let quote: string | null = null;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previous = value[index - 1];

    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? null : quote || char;
    }

    if (char === ":" && quote === null) return index;
  }

  return -1;
};

const splitInlineArray = (value: string): string[] => {
  const items: string[] = [];
  let quote: string | null = null;
  let braceDepth = 0;
  let current = "";

  for (const char of value) {
    if (char === "\"" || char === "'") {
      quote = quote === char ? null : quote || char;
    }

    if (quote === null && char === "{") braceDepth++;
    if (quote === null && char === "}") braceDepth--;

    if (char === "," && quote === null && braceDepth === 0) {
      items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) items.push(current.trim());
  return items;
};

const parseScalar = (value: string): unknown => {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  return unquote(trimmed);
};

const parseInlineObject = (value: string): Record<string, unknown> | null => {
  const trimmed = value.trim();
  const isObject = trimmed.startsWith("{") && trimmed.endsWith("}");
  if (!isObject) return null;

  const body = trimmed.slice(1, -1).trim();
  const separator = findSeparator(body);
  if (separator < 0) return null;

  const key = unquote(body.slice(0, separator));
  const objectValue = body.slice(separator + 1);
  return { [key]: parseScalar(objectValue) };
};

const parseValue = (value: string): unknown => {
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1).trim();
    return body ? splitInlineArray(body).map(parseArrayItem) : [];
  }

  return parseInlineObject(trimmed) ?? parseScalar(trimmed);
};

const parseArrayItem = (value: string): unknown => {
  const inlineObject = parseInlineObject(value);
  if (inlineObject) return inlineObject;

  const separator = findSeparator(value);
  if (separator > -1) {
    const key = unquote(value.slice(0, separator));
    return { [key]: parseValue(value.slice(separator + 1)) };
  }

  return parseValue(value);
};

const parseBlockArray = (
  lines: ParsedLine[],
  startIndex: number,
): { value: unknown[]; nextIndex: number } | null => {
  const value: unknown[] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].indent > 0) {
    const line = lines[index];
    if (!line.text.startsWith("- ")) return null;

    value.push(parseArrayItem(line.text.slice(2)));
    index++;
  }

  return { value, nextIndex: index };
};

// This is intentionally a small config parser, not a full YAML implementation.
export const parseYAML = (content: string): Record<string, unknown> | null => {
  const lines = parseLines(content);
  if (lines.length === 0) return null;

  const config: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent !== 0) return null;

    const separator = findSeparator(line.text);
    if (separator < 0) return null;

    const key = unquote(line.text.slice(0, separator));
    const rawValue = line.text.slice(separator + 1).trim();

    if (rawValue) {
      config[key] = parseValue(rawValue);
      index++;
      continue;
    }

    const block = parseBlockArray(lines, index + 1);
    if (!block) return null;

    config[key] = block.value;
    index = block.nextIndex;
  }

  return Object.keys(config).length > 0 ? config : null;
};

export const loadPackageJson = (
  filepath: string,
): Record<string, unknown> | null => {
  const json = parseJSON(readFileSync(filepath, "utf8"));
  if (!json) {
    throw new ConfigLoadError(filepath, "package.json is not valid JSON");
  }

  const codependenceConfig = json.codependence;
  return isRecord(codependenceConfig) ? codependenceConfig : null;
};

export const loadRcFile = (filepath: string): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  const extension = extname(filepath);
  const config =
    extension === ".yaml" || extension === ".yml"
      ? parseYAML(content)
      : parseJSON(content) ?? parseYAML(content);

  if (!config) {
    throw new ConfigLoadError(
      filepath,
      "file is empty, invalid, or did not export an object",
    );
  }

  return config;
};
