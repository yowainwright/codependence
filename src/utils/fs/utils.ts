import { readdirSync, statSync, type Dirent } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type {
  DirectMatchContext,
  DirectMatchItem,
  DirectMatchPlan,
  DirectMatchState,
  DirectMatchStep,
  GlobOptions,
  PatternPlan,
} from "./types";

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

const matchPatternAt = (
  value: string,
  pattern: string,
  valueIndex: number,
  patternIndex: number,
  cache: Map<number, boolean>,
): boolean => {
  const cacheKey = valueIndex * (pattern.length + 1) + patternIndex;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = calculatePatternMatch(value, pattern, valueIndex, patternIndex, cache);
  cache.set(cacheKey, result);
  return result;
};

const matchGlobStarDirectory = (
  value: string,
  pattern: string,
  valueIndex: number,
  patternIndex: number,
  cache: Map<number, boolean>,
): boolean => {
  const matchesWithoutDirectory = matchPatternAt(
    value,
    pattern,
    valueIndex,
    patternIndex + 3,
    cache,
  );
  if (matchesWithoutDirectory) return true;

  const slashIndex = value.indexOf("/", valueIndex);
  if (slashIndex === -1) return false;
  return matchPatternAt(value, pattern, slashIndex + 1, patternIndex, cache);
};

const matchGlobStar = (
  value: string,
  pattern: string,
  valueIndex: number,
  patternIndex: number,
  cache: Map<number, boolean>,
): boolean => {
  const matchesEmpty = matchPatternAt(value, pattern, valueIndex, patternIndex + 2, cache);
  if (matchesEmpty) return true;
  if (valueIndex === value.length) return false;
  return matchPatternAt(value, pattern, valueIndex + 1, patternIndex, cache);
};

const matchStar = (
  value: string,
  pattern: string,
  valueIndex: number,
  patternIndex: number,
  cache: Map<number, boolean>,
): boolean => {
  const matchesEmpty = matchPatternAt(value, pattern, valueIndex, patternIndex + 1, cache);
  if (matchesEmpty) return true;
  if (valueIndex === value.length || value[valueIndex] === "/") return false;
  return matchPatternAt(value, pattern, valueIndex + 1, patternIndex, cache);
};

const calculatePatternMatch = (
  value: string,
  pattern: string,
  valueIndex: number,
  patternIndex: number,
  cache: Map<number, boolean>,
): boolean => {
  if (patternIndex === pattern.length) return valueIndex === value.length;
  const character = pattern[patternIndex];
  const isGlobStar = character === "*" && pattern[patternIndex + 1] === "*";
  if (isGlobStar && pattern[patternIndex + 2] === "/") {
    return matchGlobStarDirectory(value, pattern, valueIndex, patternIndex, cache);
  }
  if (isGlobStar) return matchGlobStar(value, pattern, valueIndex, patternIndex, cache);
  if (character === "*") return matchStar(value, pattern, valueIndex, patternIndex, cache);
  if (valueIndex === value.length || (value[valueIndex] === "/" && character === "?")) return false;
  const matchesCharacter = character === "?" || character === value[valueIndex];
  return (
    matchesCharacter && matchPatternAt(value, pattern, valueIndex + 1, patternIndex + 1, cache)
  );
};

const isLiteralPattern = (pattern: string): boolean =>
  ["*", "?"].every((character) => !pattern.includes(character));

const toProjectPattern = (pattern: string, cwd: string): string => {
  const absolutePattern = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
  return normalizePath(relative(cwd, absolutePattern));
};

const matchesPattern = (filePath: string, pattern: string): boolean => {
  if (isLiteralPattern(pattern)) return filePath === pattern;
  return matchPatternAt(filePath, pattern, 0, 0, new Map());
};

const matchesAnyIgnore = (filePath: string, ignorePatterns: string[]): boolean =>
  ignorePatterns.some((pattern) => matchesPattern(filePath, pattern));

const isExistingDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const isExistingFile = (path: string): boolean => {
  try {
    return !statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const collectAllFiles = (dir: string, baseDir: string, ignorePatterns: string[]): string[] => {
  if (!isExistingDirectory(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    collectDirectoryEntry(entry, dir, baseDir, ignorePatterns),
  );
};

const collectDirectoryEntry = (
  entry: Dirent,
  dir: string,
  baseDir: string,
  ignorePatterns: string[],
): string[] => {
  const fullPath = join(dir, entry.name);
  const relativePath = normalizePath(relative(baseDir, fullPath));
  const comparablePath = entry.isDirectory() ? `${relativePath}/` : relativePath;

  if (matchesAnyIgnore(comparablePath, ignorePatterns)) return [];
  if (!entry.isDirectory()) return [relativePath];
  return collectAllFiles(fullPath, baseDir, ignorePatterns);
};

const toPatternArray = (patterns: string | string[]): string[] =>
  Array.isArray(patterns) ? patterns : [patterns];

const formatPath = (file: string, cwd: string, absolute: boolean): string =>
  absolute ? resolve(cwd, file) : file;

const splitPattern = (pattern: string): string[] =>
  normalizePath(pattern)
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");

const isSegmentPattern = (segment: string): boolean => !isLiteralPattern(segment);

const findLiteralPrefixLength = (segments: string[]): number => {
  const firstPatternIndex = segments.findIndex(isSegmentPattern);
  return firstPatternIndex === -1 ? segments.length : firstPatternIndex;
};

const matchSegment = (value: string, pattern: string): boolean => matchesPattern(value, pattern);

const resolvePatternRoot = (cwd: string, prefixSegments: string[]): string =>
  prefixSegments.reduce((path, segment) => resolve(path, segment), cwd);

const createDirectMatchPlan = (pattern: string, cwd: string): DirectMatchPlan | undefined => {
  const segments = splitPattern(pattern);
  const prefixLength = findLiteralPrefixLength(segments);
  const prefixSegments = segments.slice(0, prefixLength);
  const remainingSegments = segments.slice(prefixLength);
  const root = resolvePatternRoot(cwd, prefixSegments);

  if (!isExistingDirectory(root)) return undefined;
  if (remainingSegments.length === 0) return undefined;
  return { root, remainingSegments };
};

const createDirectMatchContext = (cwd: string, ignorePatterns: string[]): DirectMatchContext => ({
  cwd,
  ignorePatterns,
});

const createInitialDirectMatchState = (root: string): DirectMatchState => ({
  candidates: [root],
  results: [],
});

const toDirectMatchStep = (segment: string, index: number, segments: string[]): DirectMatchStep => {
  const lastIndex = segments.length - 1;
  const isLast = index === lastIndex;
  return { segment, isLast };
};

const toRelativePath = (cwd: string, path: string): string => normalizePath(relative(cwd, path));

const shouldIncludeRelativePath = (relativePath: string, ignorePatterns: string[]): boolean =>
  !matchesAnyIgnore(relativePath, ignorePatterns);

const getItemPaths = (items: DirectMatchItem[], type: DirectMatchItem["type"]): string[] =>
  items.filter((item) => item.type === type).map((item) => item.path);

const toDirectMatchState = (
  currentResults: string[],
  items: DirectMatchItem[],
): DirectMatchState => ({
  candidates: getItemPaths(items, "candidate"),
  results: currentResults.concat(getItemPaths(items, "result")),
});

const collectLiteralSegmentMatches = (
  candidate: string,
  step: DirectMatchStep,
  context: DirectMatchContext,
): DirectMatchItem[] => {
  const nextPath = join(candidate, step.segment);
  const relativePath = toRelativePath(context.cwd, nextPath);

  if (!shouldIncludeRelativePath(relativePath, context.ignorePatterns)) return [];
  if (step.isLast && isExistingFile(nextPath)) {
    return [{ type: "result", path: relativePath }];
  }

  if (!step.isLast && isExistingDirectory(nextPath)) {
    return [{ type: "candidate", path: nextPath }];
  }

  return [];
};

const canEnterPatternDirectory = (
  step: DirectMatchStep,
  relativePath: string,
  ignorePatterns: string[],
): boolean => !step.isLast && shouldIncludeRelativePath(relativePath, ignorePatterns);

const collectPatternEntryMatches = (
  entry: Dirent,
  candidate: string,
  step: DirectMatchStep,
  context: DirectMatchContext,
): DirectMatchItem[] => {
  if (!matchSegment(entry.name, step.segment)) return [];

  const fullPath = join(candidate, entry.name);
  const relativePath = toRelativePath(context.cwd, fullPath);

  if (entry.isDirectory()) {
    if (!canEnterPatternDirectory(step, relativePath, context.ignorePatterns)) return [];
    return [{ type: "candidate", path: fullPath }];
  }

  if (!step.isLast) return [];
  if (!shouldIncludeRelativePath(relativePath, context.ignorePatterns)) return [];
  return [{ type: "result", path: relativePath }];
};

const collectPatternSegmentMatches = (
  candidate: string,
  step: DirectMatchStep,
  context: DirectMatchContext,
): DirectMatchItem[] =>
  readdirSync(candidate, { withFileTypes: true }).flatMap((entry) =>
    collectPatternEntryMatches(entry, candidate, step, context),
  );

const collectCandidateMatches = (
  candidate: string,
  step: DirectMatchStep,
  context: DirectMatchContext,
): DirectMatchItem[] => {
  if (!isExistingDirectory(candidate)) return [];
  if (!isSegmentPattern(step.segment)) {
    return collectLiteralSegmentMatches(candidate, step, context);
  }

  return collectPatternSegmentMatches(candidate, step, context);
};

const applyDirectMatchStep = (
  state: DirectMatchState,
  segment: string,
  index: number,
  segments: string[],
  context: DirectMatchContext,
): DirectMatchState => {
  if (state.candidates.length === 0) return state;

  const step = toDirectMatchStep(segment, index, segments);
  const items = state.candidates.flatMap((candidate) =>
    collectCandidateMatches(candidate, step, context),
  );

  return toDirectMatchState(state.results, items);
};

const collectDirectMatches = (pattern: string, cwd: string, ignorePatterns: string[]): string[] => {
  const plan = createDirectMatchPlan(pattern, cwd);
  if (!plan) return [];

  const context = createDirectMatchContext(cwd, ignorePatterns);
  const initialState = createInitialDirectMatchState(plan.root);
  const finalState = plan.remainingSegments.reduce(
    (state, segment, index, segments) =>
      applyDirectMatchStep(state, segment, index, segments, context),
    initialState,
  );

  return finalState.results;
};

const collectLiteralMatch = (pattern: string, cwd: string, ignorePatterns: string[]): string[] => {
  const absolutePath = resolve(cwd, pattern);
  if (!isExistingFile(absolutePath)) return [];

  const relativePath = normalizePath(relative(cwd, absolutePath));
  if (matchesAnyIgnore(relativePath, ignorePatterns)) return [];
  return [relativePath];
};

const globStarRoot = (pattern: string, cwd: string): string => {
  const segments = splitPattern(pattern);
  const prefixLength = findLiteralPrefixLength(segments);
  return resolvePatternRoot(cwd, segments.slice(0, prefixLength));
};

const groupGlobStarPatterns = (plans: PatternPlan[], cwd: string): Map<string, string[]> =>
  plans.reduce((groups, { pattern, hasGlobStar }) => {
    if (!hasGlobStar) return groups;

    const root = globStarRoot(pattern, cwd);
    const patterns = groups.get(root) || [];
    groups.set(root, patterns.concat(pattern));
    return groups;
  }, new Map<string, string[]>());

const collectGlobStarGroup = (
  root: string,
  patterns: string[],
  cwd: string,
  ignorePatterns: string[],
): string[] => {
  const files = collectAllFiles(root, cwd, ignorePatterns);
  return files.filter((file) => patterns.some((pattern) => matchesPattern(file, pattern)));
};

const collectGlobStarMatches = (
  plans: PatternPlan[],
  cwd: string,
  ignorePatterns: string[],
): string[] => {
  const groups = groupGlobStarPatterns(plans, cwd);
  return Array.from(groups.entries()).flatMap(([root, patterns]) =>
    collectGlobStarGroup(root, patterns, cwd, ignorePatterns),
  );
};

const collectDirectPlanMatches = (
  plan: PatternPlan,
  cwd: string,
  ignorePatterns: string[],
): string[] => {
  if (isLiteralPattern(plan.pattern)) {
    return collectLiteralMatch(plan.pattern, cwd, ignorePatterns);
  }

  return collectDirectMatches(plan.pattern, cwd, ignorePatterns);
};

const createPatternPlans = (patterns: string[], cwd: string): PatternPlan[] =>
  patterns.map((pattern) => {
    const projectPattern = toProjectPattern(pattern, cwd);
    return {
      pattern: projectPattern,
      hasGlobStar: projectPattern.includes("**"),
    };
  });

const collectUniqueMatches = (
  plans: PatternPlan[],
  cwd: string,
  ignorePatterns: string[],
): string[] => {
  const directMatches = plans.flatMap((plan) =>
    plan.hasGlobStar ? [] : collectDirectPlanMatches(plan, cwd, ignorePatterns),
  );
  const globStarMatches = collectGlobStarMatches(plans, cwd, ignorePatterns);

  return Array.from(new Set(directMatches.concat(globStarMatches)));
};

export const sync = (patterns: string | string[], options: GlobOptions = {}): string[] => {
  const { cwd = process.cwd(), ignore = [], absolute = false } = options;
  const resolvedCwd = resolve(cwd);
  const plans = createPatternPlans(toPatternArray(patterns), resolvedCwd);
  const ignorePatterns = ignore.map((pattern) => toProjectPattern(pattern, resolvedCwd));

  return collectUniqueMatches(plans, resolvedCwd, ignorePatterns)
    .map((file) => formatPath(file, resolvedCwd, absolute))
    .sort();
};

export const glob = (patterns: string | string[], options: GlobOptions = {}): string[] =>
  sync(patterns, options);
