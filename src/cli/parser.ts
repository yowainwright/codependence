import { OPTION_DEFINITIONS, HELP_TEXT, ARGS_START_INDEX } from "./constants";
import type {
  ArgumentResult,
  ArgumentState,
  CollectedValue,
  OptionDefinition,
  ParsedArgs,
  ParsedFlag,
} from "./types";

const findOptionDef = (flag: string): OptionDefinition | undefined =>
  OPTION_DEFINITIONS.find((def) => def.flags.includes(flag));

const stripFlagPrefix = (flag: string): string => {
  const prefixLength = flag.startsWith("--") ? 2 : Number(flag.startsWith("-"));

  return flag.slice(prefixLength);
};

const camelCaseFlagName = (name: string): string =>
  name
    .split("-")
    .map((segment, index) => {
      if (index === 0) return segment;

      return `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`;
    })
    .join("");

const getOptionKey = (def: OptionDefinition): string => {
  const longFlag = def.flags.find((f) => f.startsWith("--")) || def.flags[0];
  const flagName = stripFlagPrefix(longFlag);

  return camelCaseFlagName(flagName);
};

const parseFlag = (arg: string): ParsedFlag => {
  const equalIndex = arg.indexOf("=");
  const hasEquals = equalIndex > -1;

  return hasEquals
    ? { flag: arg.slice(0, equalIndex), value: arg.slice(equalIndex + 1) }
    : { flag: arg };
};

const isFlag = (arg: string): boolean => arg.startsWith("-");

const collectArrayValue = (args: string[], startIndex: number): CollectedValue => {
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

const collectSingleValue = (args: string[], startIndex: number): CollectedValue => {
  const nextArg = args[startIndex + 1];
  const hasNextValue = nextArg && !isFlag(nextArg);

  return hasNextValue ? { value: nextArg, consumed: 1 } : { value: true, consumed: 0 };
};

const collectValue = (args: string[], index: number, def: OptionDefinition): CollectedValue =>
  def.isArray ? collectArrayValue(args, index) : collectSingleValue(args, index);

const applyDefaults = (options: Record<string, unknown>): Record<string, unknown> =>
  OPTION_DEFINITIONS.reduce((acc, def) => {
    const key = getOptionKey(def);
    const hasValue = acc[key] !== undefined;
    const shouldApplyDefault = !hasValue && def.defaultValue !== undefined;

    return shouldApplyDefault ? { ...acc, [key]: def.defaultValue } : acc;
  }, options);

const normalizeLockfile = (options: Record<string, unknown>): Record<string, unknown> => {
  if (options.lockfile === "true") return { ...options, lockfile: true };
  if (options.lockfile === "false") return { ...options, lockfile: false };
  return options;
};

const processArgument = (args: string[], index: number, state: ArgumentState): ArgumentResult => {
  const arg = args[index];
  const isNotFlag = !isFlag(arg);

  if (isNotFlag) {
    return { nextIndex: index + 1, options: state.options, command: arg };
  }

  const { flag, value: inlineValue } = parseFlag(arg);
  const def = findOptionDef(flag);
  const isUnknownFlag = !def;

  if (isUnknownFlag) {
    return {
      nextIndex: index + 1,
      options: state.options,
      command: state.command,
    };
  }

  const key = getOptionKey(def);
  const hasInlineValue = inlineValue !== undefined;

  if (hasInlineValue) {
    const updatedOptions = { ...state.options, [key]: inlineValue };
    return {
      nextIndex: index + 1,
      options: updatedOptions,
      command: state.command,
    };
  }

  const isBooleanFlag = !def.hasValue;

  if (isBooleanFlag) {
    const updatedOptions = { ...state.options, [key]: true };
    return {
      nextIndex: index + 1,
      options: updatedOptions,
      command: state.command,
    };
  }

  const { value, consumed } = collectValue(args, index, def);
  const updatedOptions = { ...state.options, [key]: value };

  return {
    nextIndex: index + consumed + 1,
    options: updatedOptions,
    command: state.command,
  };
};

export const parseArgs = (argv: string[]): ParsedArgs => {
  const args = argv.slice(ARGS_START_INDEX);
  let currentIndex = 0;
  let state = { options: {}, command: undefined as string | undefined };

  while (currentIndex < args.length) {
    const result = processArgument(args, currentIndex, state);
    currentIndex = result.nextIndex;
    state = { options: result.options, command: result.command };
  }

  const optionsWithDefaults = applyDefaults(state.options);
  const normalizedOptions = normalizeLockfile(optionsWithDefaults);

  return { command: state.command, options: normalizedOptions };
};

export const showHelp = (): void => {
  console.log(HELP_TEXT);
};
