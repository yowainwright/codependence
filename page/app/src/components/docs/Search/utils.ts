import type Fuse from "fuse.js";
import { MAX_RESULTS } from "./constants";
import type { SearchResult } from "./types";

export const runSearch = (fuse: Fuse<SearchResult>, query: string): SearchResult[] => {
  if (!query.length) return [];
  return fuse.search(query).slice(0, MAX_RESULTS).map((r) => r.item);
};

export const nextIndex = (current: number, total: number): number =>
  Math.min(current + 1, total - 1);

export const prevIndex = (current: number): number =>
  Math.max(current - 1, 0);

export const isOpenShortcut = (e: KeyboardEvent): boolean => {
  const isModified = e.metaKey || e.ctrlKey;
  return isModified && e.key === "k";
};

export const resolveNavigation = (
  key: string,
  selectedIndex: number,
  results: SearchResult[],
): { next?: number; navigate?: string } | null => {
  const isDown = key === "ArrowDown";
  const isUp = key === "ArrowUp";
  const isEnter = key === "Enter";
  const hasSelection = Boolean(results[selectedIndex]);

  if (isDown) return { next: nextIndex(selectedIndex, results.length) };
  if (isUp) return { next: prevIndex(selectedIndex) };
  if (isEnter && hasSelection) return { navigate: results[selectedIndex].slug };
  return null;
};
