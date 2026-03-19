import type { ErrorContext } from "./types";

export type { ErrorContext } from "./types";

const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const isMatch = b.charAt(i - 1) === a.charAt(j - 1);
      if (isMatch) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

export const findSimilarPackages = (
  target: string,
  candidates: string[],
  maxDistance = 3,
): string[] => {
  const similarities = candidates
    .map((candidate) => ({
      name: candidate,
      distance: levenshteinDistance(
        target.toLowerCase(),
        candidate.toLowerCase(),
      ),
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  return similarities.map((item) => item.name);
};

export const COMMON_PACKAGES = [
  "lodash",
  "react",
  "react-dom",
  "express",
  "axios",
  "typescript",
  "eslint",
  "prettier",
  "jest",
  "webpack",
  "vite",
  "next",
  "vue",
  "angular",
  "svelte",
  "tailwindcss",
  "prisma",
  "graphql",
  "apollo",
  "redux",
  "mobx",
  "rxjs",
  "date-fns",
  "moment",
  "dayjs",
  "chalk",
  "commander",
  "inquirer",
  "ora",
  "dotenv",
  "nodemon",
  "ts-node",
  "rimraf",
  "concurrently",
];

export const getSuggestionForPackage = (packageName: string): string | null => {
  const suggestions = findSimilarPackages(packageName, COMMON_PACKAGES, 2);
  return suggestions.length > 0 ? suggestions[0] : null;
};

export const isPrivatePackage = (packageName: string): boolean =>
  packageName.startsWith("@") && packageName.includes("/");

export const hasRegistryInError = (err: Error | string): boolean => {
  const errorStr = typeof err === "string" ? err : err.message;
  return errorStr.toLowerCase().includes("registry");
};

export const isTimeout = (err: Error | string): boolean => {
  const errorStr = typeof err === "string" ? err : err.message;
  const lowerError = errorStr.toLowerCase();
  return lowerError.includes("timeout") || lowerError.includes("timed out") || lowerError.includes("etimedout");
};

export const formatValidationError = (packageName: string): string => {
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
    "Possible issues:",
    "  - Invalid package name format",
    "  - Package name contains invalid characters",
    "",
    "> Suggestion: Check the package name spelling",
  ];
  return lines.join("\n");
};

export const formatPrivatePackageError = (packageName: string): string => {
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
    "This looks like a PRIVATE PACKAGE.",
    "",
    "To fix:",
    "  Option 1: Add .npmrc with auth token",
    "    echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc",
    "",
    "  Option 2: Configure custom registry",
    "    npm config set registry https://your-registry.com",
    "",
    "  Option 3: Exclude from codependencies",
    `    Remove "${packageName}" from your config`,
  ];
  return lines.join("\n");
};

export const formatRegistryError = (packageName: string): string => {
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
    "Package found in npm but not your registry.",
    "",
    "Your npm config may be set to a custom registry.",
    "",
    "To fix:",
    "  - Add package to your internal registry, OR",
    "  - Use public npm: npm config set registry https://registry.npmjs.org",
    "  - Use flag: codependence --registry https://registry.npmjs.org",
  ];
  return lines.join("\n");
};

export const formatTimeoutError = (packageName: string, retryCount: number): string => {
  const retryMsg = retryCount > 0 ? ` (Attempt ${retryCount}/3)` : "";
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
    `[!] Network timeout${retryMsg}`,
    "",
    "Suggestions:",
    "  - Check internet connection",
    "  - If behind proxy, configure npm config",
    "  - Increase timeout: --timeout 30000",
    "  - Retry with: npm cache clean && codependence",
  ];

  if (retryCount === 0) {
    lines.push("", "Retrying automatically...");
  }

  return lines.join("\n");
};

export const formatNetworkError = (packageName: string): string => {
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
    "Possible issues:",
    "  - Network connection issue",
    "  - npm registry is unreachable",
    "  - Firewall or proxy blocking request",
    "",
    "> Suggestion: Check your internet connection and try again",
  ];
  return lines.join("\n");
};

export const formatGenericError = (packageName: string, errorStr: string): string => {
  const suggestion = getSuggestionForPackage(packageName);
  const lines = [
    `[x] Failed to fetch version for "${packageName}"`,
    "",
  ];

  if (suggestion) {
    lines.push(
      "Possible issues:",
      `  - Package name typo? Did you mean "${suggestion}"?`,
      "  - Private package? (see suggestions above)",
      "  - Package doesn't exist on npm registry",
    );
  } else {
    lines.push(
      "Possible issues:",
      "  - Private package? (configure .npmrc)",
      "  - Package doesn't exist on npm registry",
      "  - Network issue? Check your connection",
    );
  }

  lines.push("", `> Suggestion: Run \`npm view ${packageName}\` to verify package exists`);

  const isNotSpecialCase = errorStr && !isPrivatePackage(packageName) && !hasRegistryInError(errorStr);
  if (isNotSpecialCase) {
    lines.push("", `Error: ${errorStr}`);
  }

  return lines.join("\n");
};

export const formatEnhancedError = (context: ErrorContext): string => {
  const {
    packageName,
    error: err,
    isNetworkError,
    isValidationError,
    isPrivatePackage: isPrivate,
    isRegistryMismatch,
    isTimeout: timeout,
    retryCount = 0,
  } = context;

  const errorStr = typeof err === "string" ? err : err.message;
  const detectedPrivate = isPrivate ?? isPrivatePackage(packageName);
  const detectedRegistryMismatch = isRegistryMismatch ?? hasRegistryInError(err);
  const detectedTimeout = !isNetworkError && (timeout ?? isTimeout(err));

  if (isValidationError) return formatValidationError(packageName);
  if (detectedPrivate) return formatPrivatePackageError(packageName);
  if (detectedRegistryMismatch) return formatRegistryError(packageName);
  if (detectedTimeout) return formatTimeoutError(packageName, retryCount);
  if (isNetworkError) return formatNetworkError(packageName);

  return formatGenericError(packageName, errorStr);
};
