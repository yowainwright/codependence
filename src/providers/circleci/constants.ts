export const CIRCLECI_PACKAGE_MANAGER = "circleci";

export const CIRCLECI_PATTERNS = {
  ORB_REFERENCE:
    /^([A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9_-]*)@([A-Za-z0-9][A-Za-z0-9._-]*)$/,
  PACKAGE_NAME: /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
} as const;
