export type BuildMode = "bin" | "dist";

export interface BuildBundle {
  args: string[];
  outputFile: string;
}
