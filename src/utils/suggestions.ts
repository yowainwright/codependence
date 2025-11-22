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

export interface ErrorContext {
  packageName: string;
  error: Error | string;
  isNetworkError?: boolean;
  isValidationError?: boolean;
}

export const formatEnhancedError = (context: ErrorContext): string => {
  const { packageName, error: _error, isNetworkError, isValidationError } = context;
  const lines: string[] = [];

  lines.push(`❌ Failed to fetch version for "${packageName}"`);
  lines.push("");

  if (isValidationError) {
    lines.push("Possible issues:");
    lines.push("  • Invalid package name format");
    lines.push("  • Package name contains invalid characters");
    lines.push("");
    lines.push(`Suggestion: Check the package name spelling`);
    return lines.join("\n");
  }

  if (isNetworkError) {
    lines.push("Possible issues:");
    lines.push("  • Network connection issue");
    lines.push("  • npm registry is unreachable");
    lines.push("  • Firewall or proxy blocking request");
    lines.push("");
    lines.push("Suggestion: Check your internet connection and try again");
    return lines.join("\n");
  }

  const suggestion = getSuggestionForPackage(packageName);
  if (suggestion) {
    lines.push("Possible issues:");
    lines.push(`  • Package name typo? Did you mean "${suggestion}"?`);
    lines.push("  • Private package? Add to .npmrc or use --registry");
    lines.push("  • Package doesn't exist on npm registry");
  } else {
    lines.push("Possible issues:");
    lines.push("  • Private package? Add to .npmrc or use --registry");
    lines.push("  • Package doesn't exist on npm registry");
    lines.push("  • Network issue? Check your connection");
  }

  lines.push("");
  lines.push(
    `Suggestion: Run \`npm view ${packageName}\` to verify package exists`,
  );

  return lines.join("\n");
};
