import type { SpinnerState, Spinner } from "./types";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

const stopInterval = (state: SpinnerState): SpinnerState => {
  const interval = state.interval;
  const hasInterval = interval !== null;
  if (hasInterval) {
    clearInterval(interval);
  }
  return { ...state, interval: null, isSpinning: false };
};

const incrementFrame = (state: SpinnerState): SpinnerState => {
  const nextIndex = (state.frameIndex + 1) % FRAMES.length;
  return { ...state, frameIndex: nextIndex };
};

const startInterval = (state: SpinnerState): SpinnerState => {
  const interval = setInterval(() => {
    renderFrame(FRAMES, state.frameIndex, state.text);
    Object.assign(state, incrementFrame(state));
  }, 80);

  return { ...state, interval, isSpinning: true };
};

const writeSymbol = (symbol: string, text: string): void => {
  clearLine();
  process.stdout.write(`${symbol} ${text}\n`);
};

const start = (state: SpinnerState): Spinner => {
  const isAlreadySpinning = state.isSpinning;
  if (isAlreadySpinning) {
    return createSpinnerMethods(state);
  }

  hideCursor();
  const newState = startInterval(state);
  Object.assign(state, newState);
  return createSpinnerMethods(state);
};

const stop = (state: SpinnerState): Spinner => {
  const isNotSpinning = !state.isSpinning;
  if (isNotSpinning) {
    return createSpinnerMethods(state);
  }

  const newState = stopInterval(state);
  Object.assign(state, newState);
  clearLine();
  showCursor();
  return createSpinnerMethods(state);
};

const succeed = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("✔", displayText);
  showCursor();
  return createSpinnerMethods(state);
};

const fail = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("✖", displayText);
  showCursor();
  return createSpinnerMethods(state);
};

const info = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("ℹ", displayText);
  showCursor();
  return createSpinnerMethods(state);
};

const warn = (state: SpinnerState, text?: string): Spinner => {
  const newState = stopInterval(state);
  Object.assign(state, newState);
  const displayText = text || state.text;
  writeSymbol("⚠", displayText);
  showCursor();
  return createSpinnerMethods(state);
};

const createSpinnerMethods = (state: SpinnerState): Spinner => {
  return {
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
    text,
    isSpinning: false,
    frameIndex: 0,
    interval: null,
  };

  return createSpinnerMethods(state);
};

export default createSpinner;
