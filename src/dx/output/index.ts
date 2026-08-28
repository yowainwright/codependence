import { createAnsiPattern } from "../constants";
import { LINE_BREAKS, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "./constants";
import type { SpinnerState, Spinner } from "./types";

export {
  bold,
  createTable,
  cyan,
  error,
  formatVersionTable,
  gradient,
  gray,
  green,
  red,
  success,
  yellow,
} from "./utils";
export type { Spinner, TableColumn, TableRow, TableVersionDiff, VersionTableMode } from "./types";

const singleLineText = (text: string): string => text.replace(LINE_BREAKS, " ").trimEnd();

const outputText = (text: string, interactive: boolean): string => {
  const normalized = singleLineText(text);
  return interactive ? normalized : normalized.replace(createAnsiPattern(), "");
};

const hideCursor = (): void => {
  process.stdout.write("\x1B[?25l");
};

const showCursor = (): void => {
  process.stdout.write("\x1B[?25h");
};

const clearLine = (): void => {
  process.stdout.write("\r\x1B[K");
};

const renderFrame = (frames: string[], index: number, text: string): void => {
  const frame = frames[index];
  clearLine();
  process.stdout.write(`${frame} ${text}`);
};

const clearInteractiveLine = (interactive: boolean): void => {
  if (interactive) clearLine();
};

const restoreInteractiveCursor = (interactive: boolean): void => {
  if (interactive) showCursor();
};

const stopInterval = (state: SpinnerState): SpinnerState => {
  const interval = state.interval;
  const hasInterval = interval !== null;
  if (hasInterval) {
    clearInterval(interval);
  }
  return Object.assign({}, state, { interval: null, isSpinning: false });
};

const incrementFrame = (state: SpinnerState): SpinnerState => {
  const nextIndex = (state.frameIndex + 1) % SPINNER_FRAMES.length;
  return Object.assign({}, state, { frameIndex: nextIndex });
};

const startInterval = (state: SpinnerState): SpinnerState => {
  const interval = setInterval(() => {
    renderFrame(SPINNER_FRAMES, state.frameIndex, state.text);
    Object.assign(state, incrementFrame(state));
  }, SPINNER_INTERVAL_MS);
  interval.unref();

  return Object.assign({}, state, { interval, isSpinning: true });
};

const writeSymbol = (symbol: string, text: string, interactive: boolean): void => {
  const displayText = outputText(text, interactive);
  clearInteractiveLine(interactive);
  process.stdout.write(`${symbol} ${displayText}\n`);
};

const start = (state: SpinnerState): Spinner => {
  if (!state.interactive) return createSpinnerMethods(state);

  if (state.isSpinning) {
    return createSpinnerMethods(state);
  }

  hideCursor();
  const newState = startInterval(state);
  Object.assign(state, newState);
  return createSpinnerMethods(state);
};

const stop = (state: SpinnerState): Spinner => {
  if (!state.isSpinning) {
    return createSpinnerMethods(state);
  }

  const newState = stopInterval(state);
  Object.assign(state, newState);
  clearInteractiveLine(state.interactive);
  restoreInteractiveCursor(state.interactive);
  return createSpinnerMethods(state);
};

const succeed = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("\u2714", displayText, state.interactive);
  restoreInteractiveCursor(state.interactive);
  return createSpinnerMethods(state);
};

const fail = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("\u2716", displayText, state.interactive);
  restoreInteractiveCursor(state.interactive);
  return createSpinnerMethods(state);
};

const info = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("\u2139", displayText, state.interactive);
  restoreInteractiveCursor(state.interactive);
  return createSpinnerMethods(state);
};

const warn = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("\u26A0", displayText, state.interactive);
  restoreInteractiveCursor(state.interactive);
  return createSpinnerMethods(state);
};

const createSpinnerMethods = (state: SpinnerState): Spinner => {
  return {
    get text() {
      return state.text;
    },
    set text(value: string) {
      state.text = singleLineText(value);
    },
    start: () => start(state),
    stop: () => stop(state),
    succeed: (text?: string) => succeed(state, text),
    fail: (text?: string) => fail(state, text),
    info: (text?: string) => info(state, text),
    warn: (text?: string) => warn(state, text),
  };
};

export const createSpinner = (text: string): Spinner => {
  const state: SpinnerState = {
    text: singleLineText(text),
    interactive: Boolean(process.stdout.isTTY),
    isSpinning: false,
    frameIndex: 0,
    interval: null,
  };

  return createSpinnerMethods(state);
};
