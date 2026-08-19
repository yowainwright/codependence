import type { ExecFileFn, ExecResult } from "../utils/process";
import {
  ARGS_START_INDEX,
  BINARY_SCRIPT_NAME,
  HELP_TEXT,
  OPTION_DEFINITIONS,
  SCRIPT_PATH_EXTENSIONS,
} from "./constants";
import { logger } from "../observability";
import type {
  ArgumentResult,
  ArgumentState,
  CollectedValue,
  OptionDefinition,
  ParsedArgs,
  ParsedFlag,
  BinaryArgv,
  BinaryHost,
  BinaryHostExec,
  BinaryHostExecSync,
  BinaryHostQuestion,
  BinaryHostRestore,
  BinaryHostResult,
} from "./types";

let binaryHost: BinaryHost | undefined;

const parseHostResult = (result: string): ExecResult => {
  const parsed = JSON.parse(result) as BinaryHostResult;
  if (parsed.error) throw new Error(parsed.error);
  return { stdout: parsed.stdout || "", stderr: parsed.stderr || "" };
};

export const configureBinaryHost = (
  exec: BinaryHostExec,
  execSync: BinaryHostExecSync,
  question: BinaryHostQuestion,
): BinaryHostRestore => {
  const previousHost = binaryHost;
  binaryHost = { exec, execSync, question };
  return () => {
    binaryHost = previousHost;
  };
};

export const hasBinaryHost = (): boolean => binaryHost !== undefined;

export const binaryExecFile = (): ExecFileFn | undefined => {
  if (!binaryHost) return undefined;
  const host = binaryHost;
  return async (command, args, options) => {
    const result = await host.exec(command, args, options.cwd || "");
    return parseHostResult(result);
  };
};

export const runBinaryExecFileSync = (command: string, args: string[], cwd: string): boolean => {
  if (!binaryHost) return false;
  parseHostResult(binaryHost.execSync(command, args, cwd));
  return true;
};

export const askBinaryHost = (message: string): Promise<string> | undefined =>
  binaryHost?.question(message);

const hasPathSegment = (value: string): boolean => value.includes("/") || value.includes("\\");

const hasScriptExtension = (value: string): boolean =>
  SCRIPT_PATH_EXTENSIONS.some((extension) => value.endsWith(extension));

const isScriptPathArg = (value: string | undefined): boolean => {
  if (!value) return false;
  return hasPathSegment(value) || hasScriptExtension(value);
};

export const normalizeBinaryArgv = (argv: BinaryArgv): string[] => {
  const firstArg = argv[0] || BINARY_SCRIPT_NAME;
  const secondArg = argv[1];
  const hasDuplicateExecutable = secondArg === firstArg;
  if (hasDuplicateExecutable) return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(2)];

  const needsScriptArg = secondArg === undefined || !isScriptPathArg(secondArg);
  if (needsScriptArg) return [firstArg, BINARY_SCRIPT_NAME, ...argv.slice(1)];
  return [...argv];
};

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
  logger.print(HELP_TEXT);
};
