export interface ValidationResult {
  validForNewPackages: boolean;
  validForOldPackages: boolean;
  warnings?: string[];
  errors?: string[];
}

const SCOPED_PACKAGE_PATTERN = /^(?:@([^/]+?)[/])?([^/]+?)$/;
const EXCLUSION_LIST = ["node_modules", "favicon.ico"];

export const validatePackageName = (name: unknown): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (name === null) {
    errors.push("name cannot be null");
    return buildResult(warnings, errors);
  }

  if (name === undefined) {
    errors.push("name cannot be undefined");
    return buildResult(warnings, errors);
  }

  if (typeof name !== "string") {
    errors.push("name must be a string");
    return buildResult(warnings, errors);
  }

  const hasNoLength = !name.length;
  if (hasNoLength) {
    errors.push("name length must be greater than zero");
  }

  const startsWithPeriod = name.startsWith(".");
  if (startsWithPeriod) {
    errors.push("name cannot start with a period");
  }

  const startsWithUnderscore = name.startsWith("_");
  if (startsWithUnderscore) {
    errors.push("name cannot start with an underscore");
  }

  const hasTrimmedName = name.trim() === name;
  if (!hasTrimmedName) {
    errors.push("name cannot contain leading or trailing spaces");
  }

  const isExcluded = EXCLUSION_LIST.some(
    (excluded) => name.toLowerCase() === excluded,
  );
  if (isExcluded) {
    errors.push(`${name.toLowerCase()} is not a valid package name`);
  }

  const exceedsMaxLength = name.length > 214;
  if (exceedsMaxLength) {
    warnings.push("name can no longer contain more than 214 characters");
  }

  const hasUpperCase = name.toLowerCase() !== name;
  if (hasUpperCase) {
    warnings.push("name can no longer contain capital letters");
  }

  const lastSegment = name.split("/").slice(-1)[0];
  const hasSpecialChars = /[~'!()*]/.test(lastSegment);
  if (hasSpecialChars) {
    warnings.push('name can no longer contain special characters ("~\'!()*")');
  }

  const isUrlFriendly = encodeURIComponent(name) === name;
  if (!isUrlFriendly) {
    const nameMatch = name.match(SCOPED_PACKAGE_PATTERN);
    const hasNameMatch = nameMatch !== null;

    if (hasNameMatch) {
      const user = nameMatch[1];
      const pkg = nameMatch[2];

      const pkgStartsWithPeriod = pkg?.startsWith(".");
      if (pkgStartsWithPeriod) {
        errors.push("name cannot start with a period");
      }

      const userIsUrlFriendly = encodeURIComponent(user) === user;
      const pkgIsUrlFriendly = encodeURIComponent(pkg) === pkg;
      const bothUrlFriendly = userIsUrlFriendly && pkgIsUrlFriendly;

      if (bothUrlFriendly) {
        return buildResult(warnings, errors);
      }
    }

    errors.push("name can only contain URL-friendly characters");
  }

  return buildResult(warnings, errors);
};

const buildResult = (
  warnings: string[],
  errors: string[],
): ValidationResult => {
  const hasNoErrors = errors.length === 0;
  const hasNoWarnings = warnings.length === 0;

  const result: ValidationResult = {
    validForNewPackages: hasNoErrors && hasNoWarnings,
    validForOldPackages: hasNoErrors,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
};
