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

type SplitState = {
  items: string[];
  quote: string | null;
  braceDepth: number;
  bracketDepth: number;
  current: string;
};

const SPLIT_INITIAL: SplitState = {
  items: [],
  quote: null,
  braceDepth: 0,
  bracketDepth: 0,
  current: "",
};

const splitInlineArray = (value: string): string[] => {
  const chars = [...value];

  const reduceChar = (state: SplitState, char: string, index: number): SplitState => {
    const isQuoteChar = char === "\"" || char === "'";
    const togglesQuote = isQuoteChar && chars[index - 1] !== "\\";
    const openedQuote = state.quote || char;
    const closedQuote = state.quote === char ? null : openedQuote;
    const quote = togglesQuote ? closedQuote : state.quote;

    const isOpen = quote === null;
    const braceDelta = isOpen ? Number(char === "{") - Number(char === "}") : 0;
    const bracketDelta = isOpen ? Number(char === "[") - Number(char === "]") : 0;
    const braceDepth = state.braceDepth + braceDelta;
    const bracketDepth = state.bracketDepth + bracketDelta;

    const isBalanced = braceDepth === 0 && bracketDepth === 0;
    const isSeparator = char === "," && isOpen && isBalanced;

    return {
      items: isSeparator ? state.items.concat(state.current.trim()) : state.items,
      quote,
      braceDepth,
      bracketDepth,
      current: isSeparator ? "" : state.current + char,
    };
  };

  const result = chars.reduce(reduceChar, SPLIT_INITIAL);
  const trailing = result.current.trim();
  return trailing ? result.items.concat(trailing) : result.items;
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
  if (!body) return {};

  const object: Record<string, unknown> = {};
  for (const item of splitInlineArray(body)) {
    const separator = findSeparator(item);
    if (separator < 0) return null;

    const key = unquote(item.slice(0, separator));
    const objectValue = item.slice(separator + 1);
    object[key] = parseValue(objectValue);
  }

  return object;
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

type ParsedBlock = {
  value: unknown;
  nextIndex: number;
};

type ParsedField = {
  key: string;
  value: unknown;
  nextIndex: number;
};

const isArrayLine = (line: ParsedLine): boolean =>
  line.text === "-" || line.text.startsWith("- ");

const parseNestedBlock = (
  lines: ParsedLine[],
  startIndex: number,
  parentIndent: number,
): ParsedBlock | null => {
  const line = lines[startIndex];
  if (!line) return null;

  const isUnindentedArray = isArrayLine(line) && line.indent === parentIndent;
  if (line.indent <= parentIndent && !isUnindentedArray) return null;
  if (isArrayLine(line)) {
    return parseBlockArray(lines, startIndex, parentIndent);
  }

  return parseBlockObject(lines, startIndex);
};

const parseFieldValue = (
  lines: ParsedLine[],
  startIndex: number,
  parentIndent: number,
  rawValue: string,
): ParsedBlock => {
  if (rawValue) {
    return { value: parseValue(rawValue), nextIndex: startIndex };
  }

  const block = parseNestedBlock(lines, startIndex, parentIndent);
  if (block) return block;
  return { value: null, nextIndex: startIndex };
};

const parseObjectField = (
  lines: ParsedLine[],
  index: number,
): ParsedField | null => {
  const line = lines[index];
  const separator = findSeparator(line.text);
  if (separator < 0) return null;

  const key = unquote(line.text.slice(0, separator));
  const rawValue = line.text.slice(separator + 1).trim();
  const parsedValue = parseFieldValue(
    lines,
    index + 1,
    line.indent,
    rawValue,
  );
  return { key, value: parsedValue.value, nextIndex: parsedValue.nextIndex };
};

const parseBlockObject = (
  lines: ParsedLine[],
  startIndex: number,
): ParsedBlock | null => {
  const firstLine = lines[startIndex];
  if (!firstLine) return null;

  const value: Record<string, unknown> = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent !== firstLine.indent || isArrayLine(line)) break;

    const field = parseObjectField(lines, index);
    if (!field) return null;
    value[field.key] = field.value;
    index = field.nextIndex;
  }

  return { value, nextIndex: index };
};

const parseArrayObject = (
  lines: ParsedLine[],
  index: number,
  itemIndent: number,
  itemText: string,
): ParsedBlock => {
  const separator = findSeparator(itemText);
  const key = unquote(itemText.slice(0, separator));
  const rawValue = itemText.slice(separator + 1).trim();
  const parsedValue = parseFieldValue(
    lines,
    index + 1,
    itemIndent,
    rawValue,
  );
  const value = { [key]: parsedValue.value };
  const nextLine = lines[parsedValue.nextIndex];
  const hasMoreFields =
    nextLine && nextLine.indent > itemIndent && !isArrayLine(nextLine);
  if (!hasMoreFields) {
    return { value, nextIndex: parsedValue.nextIndex };
  }

  const remaining = parseBlockObject(lines, parsedValue.nextIndex);
  if (!remaining || !isRecord(remaining.value)) {
    return { value, nextIndex: parsedValue.nextIndex };
  }
  return {
    value: { ...value, ...remaining.value },
    nextIndex: remaining.nextIndex,
  };
};

const parseBlockArray = (
  lines: ParsedLine[],
  startIndex: number,
  parentIndent: number,
): ParsedBlock | null => {
  const firstLine = lines[startIndex];
  if (!firstLine || !isArrayLine(firstLine)) return null;
  if (firstLine.indent < parentIndent) return null;

  const itemIndent = firstLine.indent;
  const value: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < itemIndent) break;
    if (line.indent > itemIndent) return null;
    if (!isArrayLine(line)) break;

    const itemText = line.text.slice(1).trimStart();
    if (findSeparator(itemText) > -1) {
      const objectItem = parseArrayObject(lines, index, itemIndent, itemText);
      value.push(objectItem.value);
      index = objectItem.nextIndex;
      continue;
    }

    if (itemText) {
      value.push(parseArrayItem(itemText));
      index++;
      continue;
    }

    const block = parseNestedBlock(lines, index + 1, itemIndent);
    if (!block) return null;
    value.push(block.value);
    index = block.nextIndex;
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

    const block = parseNestedBlock(lines, index + 1, line.indent);
    if (!block) {
      config[key] = null;
      index++;
      continue;
    }

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

export const loadRcFile = (filepath: string): Record<string, unknown> => {
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
