import { expect, test } from "bun:test";
import { runSearch, nextIndex, prevIndex, isOpenShortcut, resolveNavigation } from "./utils";
import { MAX_RESULTS } from "./constants";
import type { SearchResult } from "./types";

const makeItem = (i: number): SearchResult => ({
  title: `title ${i}`,
  description: `desc ${i}`,
  content: `content ${i}`,
  slug: `slug-${i}`,
});

const makeFuse = (items: SearchResult[]) =>
  ({
    search: () => items.map((item) => ({ item, refIndex: 0, score: 0 })),
  }) as any;

test("runSearch returns empty array for empty query", () => {
  const fuse = makeFuse([makeItem(0)]);
  expect(runSearch(fuse, "")).toEqual([]);
});

test("runSearch returns up to MAX_RESULTS items", () => {
  const items = Array.from({ length: MAX_RESULTS + 3 }, (_, i) => makeItem(i));
  const results = runSearch(makeFuse(items), "title");
  expect(results).toHaveLength(MAX_RESULTS);
});

test("runSearch returns items, not fuse wrappers", () => {
  const item = makeItem(0);
  const results = runSearch(makeFuse([item]), "title");
  expect(results[0]).toEqual(item);
});

test("nextIndex advances by one", () => {
  expect(nextIndex(0, 5)).toBe(1);
  expect(nextIndex(3, 5)).toBe(4);
});

test("nextIndex clamps at last item", () => {
  expect(nextIndex(4, 5)).toBe(4);
  expect(nextIndex(5, 5)).toBe(4);
});

test("prevIndex decrements by one", () => {
  expect(prevIndex(3)).toBe(2);
  expect(prevIndex(1)).toBe(0);
});

test("prevIndex clamps at 0", () => {
  expect(prevIndex(0)).toBe(0);
});

test("isOpenShortcut returns true for Cmd+K", () => {
  const e = { metaKey: true, ctrlKey: false, key: "k" } as KeyboardEvent;
  expect(isOpenShortcut(e)).toBe(true);
});

test("isOpenShortcut returns true for Ctrl+K", () => {
  const e = { metaKey: false, ctrlKey: true, key: "k" } as KeyboardEvent;
  expect(isOpenShortcut(e)).toBe(true);
});

test("isOpenShortcut returns false for plain K", () => {
  const e = { metaKey: false, ctrlKey: false, key: "k" } as KeyboardEvent;
  expect(isOpenShortcut(e)).toBe(false);
});

test("resolveNavigation returns next index for ArrowDown", () => {
  const results = [makeItem(0), makeItem(1), makeItem(2)];
  expect(resolveNavigation("ArrowDown", 0, results)).toEqual({ next: 1 });
});

test("resolveNavigation returns prev index for ArrowUp", () => {
  const results = [makeItem(0), makeItem(1)];
  expect(resolveNavigation("ArrowUp", 1, results)).toEqual({ next: 0 });
});

test("resolveNavigation returns navigate slug for Enter", () => {
  const results = [makeItem(0)];
  expect(resolveNavigation("Enter", 0, results)).toEqual({ navigate: "slug-0" });
});

test("resolveNavigation returns null for Enter with no selection", () => {
  expect(resolveNavigation("Enter", 0, [])).toBeNull();
});

test("resolveNavigation returns null for unhandled keys", () => {
  expect(resolveNavigation("Tab", 0, [makeItem(0)])).toBeNull();
});
