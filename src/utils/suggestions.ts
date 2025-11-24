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

const isPrivatePackage = (packageName: string): boolean => {
  return packageName.startsWith("@") && packageName.includes("/");
};

const hasRegistryInError = (error: Error | string): boolean => {
  const errorStr = typeof error === "string" ? error : error.message;
  return errorStr.toLowerCase().includes("registry");
};

const isTimeout = (error: Error | string): boolean => {
  const errorStr = typeof error === "string" ? error : error.message;
  const lowerError = errorStr.toLowerCase();
  return lowerError.includes("timeout") || lowerError.includes("timed out") || lowerError.includes("etimedout");
};

export interface ErrorContext {
  packageName: string;
  error: Error | string;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  isPrivatePackage?: boolean;
  isRegistryMismatch?: boolean;
  isTimeout?: boolean;
  retryCount?: number;
}

export const formatEnhancedError = (context: ErrorContext): string => {
  const {
    packageName,
    error,
    isNetworkError,
    isValidationError,
    isPrivatePackage: isPrivate,
    isRegistryMismatch,
    isTimeout: timeout,
    retryCount = 0,
  } = context;

  const lines: string[] = [];
  const errorStr = typeof error === "string" ? error : error.message;

  lines.push(`❌ Failed to fetch version for "${packageName}"`);
  lines.push("");

  const detectedPrivate = isPrivate ?? isPrivatePackage(packageName);
  const detectedRegistryMismatch = isRegistryMismatch ?? hasRegistryInError(error);
  const detectedTimeout = !isNetworkError && (timeout ?? isTimeout(error));

  if (isValidationError) {
    lines.push("Possible issues:");
    lines.push("  • Invalid package name format");
    lines.push("  • Package name contains invalid characters");
    lines.push("");
    lines.push("💡 Suggestion: Check the package name spelling");
    return lines.join("\n");
  }

  if (detectedPrivate) {
    lines.push("This looks like a PRIVATE PACKAGE.");
    lines.push("");
    lines.push("To fix:");
    lines.push("  Option 1: Add .npmrc with auth token");
    lines.push("    echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc");
    lines.push("");
    lines.push("  Option 2: Configure custom registry");
    lines.push("    npm config set registry https://your-registry.com");
    lines.push("");
    lines.push("  Option 3: Exclude from codependencies");
    lines.push(`    Remove "${packageName}" from your config`);
    return lines.join("\n");
  }

  if (detectedRegistryMismatch) {
    lines.push("Package found in npm but not your registry.");
    lines.push("");
    lines.push(`Your npm config may be set to a custom registry.`);
    lines.push("");
    lines.push("To fix:");
    lines.push("  • Add package to your internal registry, OR");
    lines.push("  • Use public npm: npm config set registry https://registry.npmjs.org");
    lines.push(`  • Use flag: codependence --registry https://registry.npmjs.org`);
    return lines.join("\n");
  }

  if (detectedTimeout) {
    const retryMsg = retryCount > 0 ? ` (Attempt ${retryCount}/3)` : "";
    lines.push(`⚠️  Network timeout${retryMsg}`);
    lines.push("");
    lines.push("Suggestions:");
    lines.push("  • Check internet connection");
    lines.push("  • If behind proxy, configure npm config");
    lines.push("  • Increase timeout: --timeout 30000");
    lines.push("  • Retry with: npm cache clean && codependence");

    if (retryCount === 0) {
      lines.push("");
      lines.push("Retrying automatically...");
    }
    return lines.join("\n");
  }

  if (isNetworkError) {
    lines.push("Possible issues:");
    lines.push("  • Network connection issue");
    lines.push("  • npm registry is unreachable");
    lines.push("  • Firewall or proxy blocking request");
    lines.push("");
    lines.push("💡 Suggestion: Check your internet connection and try again");
    return lines.join("\n");
  }

  const suggestion = getSuggestionForPackage(packageName);
  if (suggestion) {
    lines.push("Possible issues:");
    lines.push(`  • Package name typo? Did you mean "${suggestion}"?`);
    lines.push("  • Private package? (see suggestions above)");
    lines.push("  • Package doesn't exist on npm registry");
  } else {
    lines.push("Possible issues:");
    lines.push("  • Private package? (configure .npmrc)");
    lines.push("  • Package doesn't exist on npm registry");
    lines.push("  • Network issue? Check your connection");
  }

  lines.push("");
  lines.push(
    `💡 Suggestion: Run \`npm view ${packageName}\` to verify package exists`,
  );

  if (errorStr && !isPrivate && !detectedRegistryMismatch) {
    lines.push("");
    lines.push(`Error: ${errorStr}`);
  }

  return lines.join("\n");
};
