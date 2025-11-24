import { error } from "../utils/colors";
import type { ValidationError, ValidationResult } from "./types";

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const concat = <T>(...arrays: T[][]): T[] =>
  arrays.reduce((acc, arr) => [...acc, ...arr], []);

const validateCodeDependenciesItem = (
  item: unknown,
): ValidationError | null => {
  if (isString(item)) {
    const hasLength = item.length > 0;
    return hasLength
      ? null
      : {
          field: "codependencies",
          message: "Package name cannot be empty string",
          suggestion: "Remove empty strings from the codependencies array",
        };
  }

  if (isObject(item)) {
    const keys = Object.keys(item);
    const hasOneKey = keys.length === 1;

    if (!hasOneKey) {
      const suggestion =
        keys.length === 0
          ? "Remove empty objects from codependencies array"
          : `Split into multiple objects: ${keys.map((k) => `{"${k}": "${item[k]}"}`).join(", ")}`;

      return {
        field: "codependencies",
        message: `Object in codependencies must have exactly one key, found ${keys.length}`,
        suggestion,
      };
    }

    const key = keys[0];
    const value = item[key];

    if (!isString(value)) {
      return {
        field: `codependencies.${key}`,
        message: "Version value must be a string",
        suggestion: `Change {"${key}": ${JSON.stringify(value)}} to {"${key}": "${value}"}`,
      };
    }

    return null;
  }

  return {
    field: "codependencies",
    message: `Invalid item type: ${typeof item}`,
    suggestion:
      'Each item must be either a string (package name) or an object ({"package": "version"})',
  };
};

const validateRootObject = (config: unknown): ValidationError[] =>
  isObject(config)
    ? []
    : [
        {
          field: "root",
          message: "Configuration must be a JSON object",
          suggestion: 'Wrap your config in {}: {"codependencies": [...]}',
        },
      ];

const validateRequiredFields = (
  config: Record<string, unknown>,
): ValidationError[] => {
  const hasCodependencies = "codependencies" in config;
  const hasPermissive = "permissive" in config;
  const hasNeitherRequired = !hasCodependencies && !hasPermissive;

  return hasNeitherRequired
    ? [
        {
          field: "root",
          message:
            'Configuration must have either "codependencies" or "permissive" field',
          suggestion:
            'Add {"codependencies": ["package-name"]} or {"permissive": true}',
        },
      ]
    : [];
};

const validateCodependencies = (
  config: Record<string, unknown>,
): ValidationError[] => {
  if (!("codependencies" in config)) {
    return [];
  }

  const codependencies = config.codependencies;

  if (!isArray(codependencies)) {
    return [
      {
        field: "codependencies",
        message: `"codependencies" must be an array, got ${typeof codependencies}`,
        suggestion:
          'Change to array format: {"codependencies": ["package1", "package2"]}',
      },
    ];
  }

  return codependencies
    .map((item, index) => {
      const itemError = validateCodeDependenciesItem(item);
      return itemError ? { ...itemError, field: `codependencies[${index}]` } : null;
    })
    .filter((itemError): itemError is ValidationError => itemError !== null);
};

const validatePermissive = (
  config: Record<string, unknown>,
): ValidationError[] => {
  if (!("permissive" in config)) {
    return [];
  }

  const permissive = config.permissive;

  return isBoolean(permissive)
    ? []
    : [
        {
          field: "permissive",
          message: `"permissive" must be a boolean, got ${typeof permissive}`,
          suggestion:
            'Change to: {"permissive": true} or {"permissive": false}',
        },
      ];
};

const validateLanguage = (
  config: Record<string, unknown>,
): ValidationError[] => {
  if (!("language" in config)) {
    return [];
  }

  const language = config.language;
  const validLanguages = ["nodejs", "python", "go"];

  if (!isString(language)) {
    return [
      {
        field: "language",
        message: `"language" must be a string, got ${typeof language}`,
        suggestion: `Use one of: ${validLanguages.join(", ")}`,
      },
    ];
  }

  return validLanguages.includes(language)
    ? []
    : [
        {
          field: "language",
          message: `Invalid language "${language}"`,
          suggestion: `Must be one of: ${validLanguages.join(", ")}`,
        },
      ];
};

const validateFiles = (config: Record<string, unknown>): ValidationError[] => {
  if (!("files" in config)) {
    return [];
  }

  const files = config.files;

  if (!isArray(files)) {
    return [
      {
        field: "files",
        message: `"files" must be an array, got ${typeof files}`,
        suggestion: 'Use array format: {"files": ["**/package.json"]}',
      },
    ];
  }

  const hasInvalidFiles = files.some((f) => !isString(f));

  return hasInvalidFiles
    ? [
        {
          field: "files",
          message: "All file patterns must be strings",
          suggestion: "Remove non-string values from files array",
        },
      ]
    : [];
};

const validateIgnore = (
  config: Record<string, unknown>,
): ValidationError[] => {
  if (!("ignore" in config)) {
    return [];
  }

  const ignore = config.ignore;

  if (!isArray(ignore)) {
    return [
      {
        field: "ignore",
        message: `"ignore" must be an array, got ${typeof ignore}`,
        suggestion: 'Use array format: {"ignore": ["**/node_modules/**"]}',
      },
    ];
  }

  const hasInvalidIgnore = ignore.some((i) => !isString(i));

  return hasInvalidIgnore
    ? [
        {
          field: "ignore",
          message: "All ignore patterns must be strings",
          suggestion: "Remove non-string values from ignore array",
        },
      ]
    : [];
};

const validateUnknownFields = (
  config: Record<string, unknown>,
): ValidationError[] => {
  const knownFields = [
    "codependencies",
    "permissive",
    "language",
    "files",
    "ignore",
  ];

  const unknownFields = Object.keys(config).filter(
    (key) => !knownFields.includes(key),
  );

  return unknownFields.length > 0
    ? [
        {
          field: "root",
          message: `Unknown field(s): ${unknownFields.join(", ")}`,
          suggestion: `Remove unknown fields. Valid fields are: ${knownFields.join(", ")}`,
        },
      ]
    : [];
};

export const validateConfig = (config: unknown): ValidationResult => {
  const rootErrors = validateRootObject(config);

  if (rootErrors.length > 0) {
    return {
      valid: false,
      errors: rootErrors,
    };
  }

  const typedConfig = config as Record<string, unknown>;

  const errors = concat(
    validateRequiredFields(typedConfig),
    validateCodependencies(typedConfig),
    validatePermissive(typedConfig),
    validateLanguage(typedConfig),
    validateFiles(typedConfig),
    validateIgnore(typedConfig),
    validateUnknownFields(typedConfig),
  );

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  const errorLines = errors.flatMap((validationError, index) => {
    const mainLine = `${index + 1}. ${validationError.field}: ${validationError.message}`;
    const suggestionLine = validationError.suggestion
      ? `   💡 ${validationError.suggestion}`
      : null;
    return [mainLine, suggestionLine, ""].filter(
      (line): line is string => line !== null,
    );
  });

  return [`${error("✗")} Invalid configuration:\n`, ...errorLines].join("\n");
};
