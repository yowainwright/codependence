import { error } from "../utils/colors";
import { VALID_LANGUAGES, VALID_LEVELS, VALID_MODES, KNOWN_FIELDS } from "./constants";
import type { ValidationError, ValidationResult } from "./types";

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const concat = <T>(...arrays: T[][]): T[] =>
  arrays.reduce((acc, arr) => [...acc, ...arr], []);

const validateStringItem = (item: string): ValidationError | null => {
  const hasLength = item.length > 0;
  return hasLength
    ? null
    : {
        field: "codependencies",
        message: "Package name cannot be empty string",
        suggestion: "Remove empty strings from the codependencies array",
      };
};

const validateObjectItem = (item: Record<string, unknown>): ValidationError | null => {
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
};

const validateCodeDependenciesItem = (
  item: unknown,
): ValidationError | null => {
  if (isString(item)) return validateStringItem(item);
  if (isObject(item)) return validateObjectItem(item);

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
  const hasMode = "mode" in config;
  const hasNeitherRequired = !hasCodependencies && !hasPermissive && !hasMode;

  return hasNeitherRequired
    ? [
        {
          field: "root",
          message:
            'Configuration must have either "codependencies", "permissive", or "mode" field',
          suggestion:
            'Add {"codependencies": ["package-name"]}, {"permissive": true}, or {"mode": "precise"}',
        },
      ]
    : [];
};

const validateCodependencies = (
  config: Record<string, unknown>,
): ValidationError[] => {
  if (!("codependencies" in config)) return [];

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
  if (!("permissive" in config)) return [];

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

export const createEnumValidator = (
  field: string,
  validValues: readonly string[],
) => (config: Record<string, unknown>): ValidationError[] => {
  if (!(field in config)) return [];

  const value = config[field];
  const valueList = validValues.join(", ");

  if (!isString(value)) {
    return [
      {
        field,
        message: `"${field}" must be a string, got ${typeof value}`,
        suggestion: `Use one of: ${valueList}`,
      },
    ];
  }

  const isValid = (validValues as readonly string[]).includes(value);
  return isValid
    ? []
    : [
        {
          field,
          message: `Invalid ${field} "${value}"`,
          suggestion: `Must be one of: ${valueList}`,
        },
      ];
};

export const createArrayValidator = (
  field: string,
  itemLabel: string,
  arraySuggestion: string,
) => (config: Record<string, unknown>): ValidationError[] => {
  if (!(field in config)) return [];

  const value = config[field];

  if (!isArray(value)) {
    return [
      {
        field,
        message: `"${field}" must be an array, got ${typeof value}`,
        suggestion: `Use array format: ${arraySuggestion}`,
      },
    ];
  }

  const hasInvalidItems = value.some((item) => !isString(item));

  return hasInvalidItems
    ? [
        {
          field,
          message: `All ${itemLabel} patterns must be strings`,
          suggestion: `Remove non-string values from ${field} array`,
        },
      ]
    : [];
};

const validateLanguage = createEnumValidator("language", VALID_LANGUAGES);
const validateLevel = createEnumValidator("level", VALID_LEVELS);
const validateMode = createEnumValidator("mode", VALID_MODES);
const validateFiles = createArrayValidator("files", "file", '{"files": ["**/package.json"]}');
const validateIgnore = createArrayValidator("ignore", "ignore", '{"ignore": ["**/node_modules/**"]}');

const validateUnknownFields = (
  config: Record<string, unknown>,
): ValidationError[] => {
  const unknownFields = Object.keys(config).filter(
    (key) => !(KNOWN_FIELDS as readonly string[]).includes(key),
  );

  return unknownFields.length > 0
    ? [
        {
          field: "root",
          message: `Unknown field(s): ${unknownFields.join(", ")}`,
          suggestion: `Remove unknown fields. Valid fields are: ${KNOWN_FIELDS.join(", ")}`,
        },
      ]
    : [];
};

export const validateConfig = (config: unknown): ValidationResult => {
  const rootErrors = validateRootObject(config);

  if (rootErrors.length > 0) {
    return { valid: false, errors: rootErrors };
  }

  const typedConfig = config as Record<string, unknown>;

  const errors = concat(
    validateRequiredFields(typedConfig),
    validateCodependencies(typedConfig),
    validatePermissive(typedConfig),
    validateLanguage(typedConfig),
    validateLevel(typedConfig),
    validateMode(typedConfig),
    validateFiles(typedConfig),
    validateIgnore(typedConfig),
    validateUnknownFields(typedConfig),
  );

  return { valid: errors.length === 0, errors };
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  const errorLines = errors.flatMap((validationError, index) => {
    const mainLine = `${index + 1}. ${validationError.field}: ${validationError.message}`;
    const suggestionLine = validationError.suggestion
      ? `   > ${validationError.suggestion}`
      : null;
    return [mainLine, suggestionLine, ""].filter(
      (line): line is string => line !== null,
    );
  });

  return [`${error("x")} Invalid configuration:\n`, ...errorLines].join("\n");
};
