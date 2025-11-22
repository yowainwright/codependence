import { execFile } from "child_process";
import { promisify } from "util";
import type { ExecResult } from "./types";

const execFileAsync = promisify(execFile);

export const exec = async (
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<ExecResult> => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    ...options,
    encoding: "utf8",
  });

  return {
    stdout: stdout || "",
    stderr: stderr || "",
  };
};
