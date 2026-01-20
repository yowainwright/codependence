import { ANSI } from './constants';
import type { Output } from './types';

export const createOutput = (
  stream: NodeJS.WriteStream = process.stdout,
): Output => ({
  write: (text: string) => stream.write(text),
  writeLine: (text: string) => stream.write(`${text}\n`),
  clearLine: () => stream.write(ANSI.CLEAR_LINE),
  hideCursor: () => stream.write(ANSI.HIDE_CURSOR),
  showCursor: () => stream.write(ANSI.SHOW_CURSOR),
});

export const defaultOutput = createOutput();