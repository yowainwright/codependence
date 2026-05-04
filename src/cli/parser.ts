import { OPTION_DEFINITIONS, HELP_TEXT, ARGS_START_INDEX } from "./constants";
import type {
  ParsedArgs,
  OptionDefinition,
  ParsedFlag,
  CollectedValue,
} from "./types";

const findOptionDef = (flag: string): OptionDefinition | undefined =>
  OPTION_DEFINITIONS.find((def) => def.flags.includes(flag));

const getOptionKey = (def: OptionDefinition): string => {
  const longFlag = def.flags.find((f) => f.startsWith("--")) || def.flags[0];
  return longFlag
    .replace(/^--?/, "")
    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

const parseFlag = (arg: string): ParsedFlag => {
  const equalIndex = arg.indexOf("=");
  const hasEquals = equalIndex > -1;

  return hasEquals
    ? { flag: arg.slice(0, equalIndex), value: arg.slice(equalIndex + 1) }
    : { flag: arg };
};

const isFlag = (arg: string): boolean => arg.startsWith("-");

const collectArrayValue = (
  args: string[],
  startIndex: number,
): CollectedValue => {
  const values: string[] = [];
  let currentIndex = startIndex + 1;

  while (currentIndex < args.length && !isFlag(args[currentIndex])) {
    values.push(args[currentIndex]);
    currentIndex++;
  }

  const hasValues = values.length > 0;
  const consumed = currentIndex - startIndex - 1;

  return { value: hasValues ? values : undefined, consumed };
};

const collectSingleValue = (
  args: string[],
  startIndex: number,
  flag: string,
): CollectedValue => {
  const nextArg = args[startIndex + 1];
  const hasNextValue = nextArg && !isFlag(nextArg);

  if (!hasNextValue) {
    throw new Error(`Option ${flag} requires a value`);
  }

  return { value: nextArg, consumed: 1 };
};

const collectValue = (
  args: string[],
  index: number,
  def: OptionDefinition,
  flag: string,
): CollectedValue =>
  def.isArray
    ? collectArrayValue(args, index)
    : collectSingleValue(args, index, flag);

const validateValue = (
  def: OptionDefinition,
  value: unknown,
  flag: string,
): void => {
  if (!def.validValues || value === undefined) return;

  const isValid = typeof value === "string" && def.validValues.includes(value);
  if (isValid) return;

  throw new Error(
    `Invalid value for ${flag}: ${String(value)}. Expected one of: ${def.validValues.join(", ")}`,
  );
};

const parseCodependencyValue = (
  value: string,
): string | Record<string, string> => {
  const trimmed = value.trim();
  const shouldParseJsonObject = trimmed.startsWith("{");
  if (!shouldParseJsonObject) return value;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const isObject =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    if (isObject) return parsed as Record<string, string>;
  } catch {
    throw new Error(`Invalid codependency object: ${value}`);
  }

  throw new Error(`Invalid codependency object: ${value}`);
};

const normalizeValue = (key: string, value: unknown): unknown => {
  if (key !== "codependencies" || !Array.isArray(value)) return value;
  return value.map((item) =>
    typeof item === "string" ? parseCodependencyValue(item) : item,
  );
};

const applyDefaults = (
  options: Record<string, unknown>,
): Record<string, unknown> =>
  OPTION_DEFINITIONS.reduce((acc, def) => {
    const key = getOptionKey(def);
    const hasValue = acc[key] !== undefined;
    const shouldApplyDefault = !hasValue && def.defaultValue !== undefined;

    return shouldApplyDefault ? { ...acc, [key]: def.defaultValue } : acc;
  }, options);

const processArgument = (
  args: string[],
  index: number,
  state: { options: Record<string, unknown>; positionals: string[] },
): {
  nextIndex: number;
  options: Record<string, unknown>;
  positionals: string[];
} => {
  const arg = args[index];
  const isNotFlag = !isFlag(arg);

  if (isNotFlag) {
    return {
      nextIndex: index + 1,
      options: state.options,
      positionals: [...state.positionals, arg],
    };
  }

  const { flag, value: inlineValue } = parseFlag(arg);
  const def = findOptionDef(flag);
  const isUnknownFlag = !def;

  if (isUnknownFlag) {
    throw new Error(`Unknown option: ${flag}`);
  }

  const key = getOptionKey(def);
  const hasInlineValue = inlineValue !== undefined;

  if (hasInlineValue) {
    const rawValue = def.isArray ? [inlineValue] : inlineValue;
    validateValue(def, rawValue, flag);
    const normalizedValue = normalizeValue(key, rawValue);
    const updatedOptions = { ...state.options, [key]: normalizedValue };
    return {
      nextIndex: index + 1,
      options: updatedOptions,
      positionals: state.positionals,
    };
  }

  const isBooleanFlag = !def.hasValue;

  if (isBooleanFlag) {
    const updatedOptions = { ...state.options, [key]: true };
    return {
      nextIndex: index + 1,
      options: updatedOptions,
      positionals: state.positionals,
    };
  }

  const { value, consumed } = collectValue(args, index, def, flag);
  validateValue(def, value, flag);
  const normalizedValue = normalizeValue(key, value);
  const updatedOptions = { ...state.options, [key]: normalizedValue };

  return {
    nextIndex: index + consumed + 1,
    options: updatedOptions,
    positionals: state.positionals,
  };
};

export const parseArgs = (argv: string[]): ParsedArgs => {
  const args = argv.slice(ARGS_START_INDEX);
  let currentIndex = 0;
  let state = { options: {}, positionals: [] as string[] };

  while (currentIndex < args.length) {
    const result = processArgument(args, currentIndex, state);
    currentIndex = result.nextIndex;
    state = { options: result.options, positionals: result.positionals };
  }

  const optionsWithDefaults = applyDefaults(state.options);

  return {
    command: state.positionals[0],
    positionals: state.positionals,
    options: optionsWithDefaults,
  };
};

export const showHelp = (): void => {
  console.log(HELP_TEXT);
};
