import type { IFuseOptions } from "fuse.js";
import type { SearchResult } from "./types";

export const FUSE_OPTIONS: IFuseOptions<SearchResult> = {
  keys: ["title", "description", "content"],
  threshold: 0.3,
  includeScore: true,
};

export const MAX_RESULTS = 5;

export const QUICK_LINKS = [
  { slug: "introduction", label: "Introduction to Codependence" },
  { slug: "cli", label: "CLI Usage Guide" },
] as const;
