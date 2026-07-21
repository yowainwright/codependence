import { isAbsolute, win32 } from "node:path";
import { error } from "../utils/colors";
import {
  BOOLEAN_OPTION_FIELDS,
  VALID_FORMATS,
  VALID_LANGUAGES,
  VALID_LEVELS,
  VALID_MANAGERS,
  VALID_MODES,
  KNOWN_FIELDS,
  TARGET_FIELDS,
  TARGET_POLICY_FIELDS,
} from "./constants";
import type { ValidationError, ValidationOptions, ValidationResult } from "./types";

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const concat = <T>(...arrays: T[][]): T[] => arrays.reduce((acc, arr) => [...acc, ...arr], []);

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

const validateCodeDependenciesItem = (item: unknown): ValidationError | null => {
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

const validateRequiredFields = (config: Record<string, unknown>): ValidationError[] => {
  const hasCodependencies = "codependencies" in config;
  const hasPermissive = "permissive" in config;
  const hasMode = "mode" in config;
  const hasNeitherRequired = !hasCodependencies && !hasPermissive && !hasMode;

  return hasNeitherRequired
    ? [
        {
          field: "root",
          message: 'Configuration must have either "codependencies", "permissive", or "mode" field',
          suggestion:
            'Add {"codependencies": ["package-name"]}, {"permissive": true}, or {"mode": "precise"}',
        },
      ]
    : [];
};

const validateCodependencies = (config: Record<string, unknown>): ValidationError[] => {
  if (!("codependencies" in config)) return [];

  const codependencies = config.codependencies;

  if (!isArray(codependencies)) {
    return [
      {
        field: "codependencies",
        message: `"codependencies" must be an array, got ${typeof codependencies}`,
        suggestion: 'Change to array format: {"codependencies": ["package1", "package2"]}',
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

const validatePermissive = (config: Record<string, unknown>): ValidationError[] => {
  if (!("permissive" in config)) return [];

  const permissive = config.permissive;

  return isBoolean(permissive)
    ? []
    : [
        {
          field: "permissive",
          message: `"permissive" must be a boolean, got ${typeof permissive}`,
          suggestion: 'Change to: {"permissive": true} or {"permissive": false}',
        },
      ];
};

export const createEnumValidator =
  (field: string, validValues: readonly string[]) =>
  (config: Record<string, unknown>): ValidationError[] => {
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

export const createArrayValidator =
  (field: string, itemLabel: string, arraySuggestion: string) =>
  (config: Record<string, unknown>): ValidationError[] => {
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
const validateManager = createEnumValidator("manager", VALID_MANAGERS);
const validateLevel = createEnumValidator("level", VALID_LEVELS);
const validateMode = createEnumValidator("mode", VALID_MODES);
const validateFiles = createArrayValidator("files", "file", '{"files": ["**/package.json"]}');
const validateIgnore = createArrayValidator(
  "ignore",
  "ignore",
  '{"ignore": ["**/node_modules/**"]}',
);
const validateFormat = createEnumValidator("format", VALID_FORMATS);

const validateStringField =
  (field: string) =>
  (config: Record<string, unknown>): ValidationError[] => {
    if (!(field in config)) return [];

    return isString(config[field])
      ? []
      : [
          {
            field,
            message: `"${field}" must be a string, got ${typeof config[field]}`,
            suggestion: `Use a string value for "${field}"`,
          },
        ];
  };

const validateBooleanField =
  (field: string) =>
  (config: Record<string, unknown>): ValidationError[] => {
    if (!(field in config)) return [];

    return isBoolean(config[field])
      ? []
      : [
          {
            field,
            message: `"${field}" must be a boolean, got ${typeof config[field]}`,
            suggestion: `Use true or false for "${field}"`,
          },
        ];
  };

const validateRootDir = validateStringField("rootDir");
const validateOutputFile = validateStringField("outputFile");
const validateBooleanOptions = BOOLEAN_OPTION_FIELDS.map(validateBooleanField);

const isSafeLockfilePath = (path: string): boolean => {
  const segments = path.split(/[\\/]/);
  const hasValue = path.length > 0;
  const isRepositoryRelative = !isAbsolute(path) && !win32.isAbsolute(path);
  const hasNoParentTraversal = !segments.includes("..");
  return hasValue && isRepositoryRelative && hasNoParentTraversal;
};

const validateLockfile = (config: Record<string, unknown>): ValidationError[] => {
  if (!("lockfile" in config)) return [];

  const lockfile = config.lockfile;
  if (isBoolean(lockfile)) return [];

  const paths = isString(lockfile) ? [lockfile] : lockfile;
  const isStringArray = isArray(paths) && paths.every(isString);
  const hasPaths = isStringArray && paths.length > 0;
  const hasSafePaths = hasPaths && paths.every(isSafeLockfilePath);
  const isValid = hasSafePaths;
  if (isValid) return [];

  return [
    {
      field: "lockfile",
      message: '"lockfile" must be a boolean or non-empty repository-relative path list',
      suggestion: 'Use true, false, "path/to/lockfile", or ["path/to/lockfile"]',
    },
  ];
};

const validateUnknownFields = (
  config: Record<string, unknown>,
  knownFields: readonly string[] = KNOWN_FIELDS,
): ValidationError[] => {
  const unknownFields = Object.keys(config).filter((key) => !knownFields.includes(key));

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

const prefixTargetError = (validationError: ValidationError, index: number): ValidationError => {
  const prefix = `targets[${index}]`;
  const field = validationError.field === "root" ? prefix : `${prefix}.${validationError.field}`;
  return { ...validationError, field };
};

const targetFieldErrors = (target: Record<string, unknown>): ValidationError[] =>
  concat(
    validateRequiredFields(target),
    validateManager(target),
    validateCodependencies(target),
    validatePermissive(target),
    validateLevel(target),
    validateMode(target),
    validateFiles(target),
    validateIgnore(target),
    validateLockfile(target),
    validateRootDir(target),
    validateUnknownFields(target, TARGET_FIELDS),
  );

const missingManagerErrors = (target: Record<string, unknown>): ValidationError[] => {
  if ("manager" in target) return [];

  return [
    {
      field: "manager",
      message: 'Target must have a "manager" field',
      suggestion: `Use one of: ${VALID_MANAGERS.join(", ")}`,
    },
  ];
};

const validateTarget = (target: Record<string, unknown>, index: number): ValidationError[] => {
  const errors = [...missingManagerErrors(target), ...targetFieldErrors(target)];
  return errors.map((validationError) => prefixTargetError(validationError, index));
};

const invalidTargetsError = (targets: unknown): ValidationError[] => [
  {
    field: "targets",
    message: `"targets" must be an array, got ${typeof targets}`,
    suggestion: 'Use array format: {"targets": [{"manager": "bun"}]}',
  },
];

const emptyTargetsError = (): ValidationError[] => [
  {
    field: "targets",
    message: '"targets" must contain at least one target',
    suggestion: 'Add a target such as {"manager": "bun", "mode": "precise"}',
  },
];

const validateTargetEntry = (target: unknown, index: number): ValidationError[] => {
  if (isObject(target)) return validateTarget(target, index);

  return [
    {
      field: `targets[${index}]`,
      message: "Target must be a configuration object",
      suggestion: 'Use {"manager": "bun", "mode": "precise"}',
    },
  ];
};

const validateTargets = (config: Record<string, unknown>): ValidationError[] => {
  const targets = config.targets;
  if (!isArray(targets)) return invalidTargetsError(targets);
  if (targets.length === 0) return emptyTargetsError();

  return targets.flatMap(validateTargetEntry);
};

const mixedTargetFieldErrors = (config: Record<string, unknown>): ValidationError[] => {
  const scopedFields = [...TARGET_POLICY_FIELDS, "language", "yarnConfig"];
  const mixedFields = scopedFields.filter((field) => field in config);
  if (mixedFields.length === 0) return [];

  return [
    {
      field: "root",
      message: `Target-scoped field(s) cannot be used beside "targets": ${mixedFields.join(", ")}`,
      suggestion: "Move these fields into the appropriate target object",
    },
  ];
};

const validateTargetRoot = (config: Record<string, unknown>): ValidationError[] => {
  return concat(
    mixedTargetFieldErrors(config),
    validateTargets(config),
    validateFormat(config),
    validateOutputFile(config),
    ...validateBooleanOptions.map((validate) => validate(config)),
    validateUnknownFields(config),
  );
};

export const validateConfig = (
  config: unknown,
  options: ValidationOptions = {},
): ValidationResult => {
  const requirePolicy = options.requirePolicy ?? true;
  const rootErrors = validateRootObject(config);

  if (rootErrors.length > 0) {
    return { valid: false, errors: rootErrors };
  }

  const typedConfig = config as Record<string, unknown>;
  const hasTargets = "targets" in typedConfig;
  if (hasTargets) {
    const errors = validateTargetRoot(typedConfig);
    return { valid: errors.length === 0, errors };
  }

  const errors = concat(
    ...(requirePolicy ? [validateRequiredFields(typedConfig)] : []),
    validateCodependencies(typedConfig),
    validatePermissive(typedConfig),
    validateLanguage(typedConfig),
    validateLevel(typedConfig),
    validateMode(typedConfig),
    validateFiles(typedConfig),
    validateIgnore(typedConfig),
    validateLockfile(typedConfig),
    validateRootDir(typedConfig),
    validateOutputFile(typedConfig),
    validateFormat(typedConfig),
    ...validateBooleanOptions.map((validate) => validate(typedConfig)),
    validateUnknownFields(typedConfig),
  );

  return { valid: errors.length === 0, errors };
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  const errorLines = errors.flatMap((validationError, index) => {
    const mainLine = `${index + 1}. ${validationError.field}: ${validationError.message}`;
    const suggestionLine = validationError.suggestion ? `   > ${validationError.suggestion}` : null;
    return [mainLine, suggestionLine, ""].filter((line): line is string => line !== null);
  });

  return [`${error("x")} Invalid configuration:\n`, ...errorLines].join("\n");
};
