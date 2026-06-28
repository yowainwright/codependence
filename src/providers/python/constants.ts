import { CONDA_MANIFEST_FILES, MANIFEST_FILES, PYTHON_PACKAGE_MANAGERS } from "../constants";
import { VERSION_COMPARISON_PREFIXES, createRegexAlternation } from "../../utils/constants";

const PYTHON_REQUIREMENT_PREFIXES = VERSION_COMPARISON_PREFIXES.filter((prefix) => prefix !== "=");
const PYTHON_REQUIREMENT_PREFIX_PATTERN = createRegexAlternation(PYTHON_REQUIREMENT_PREFIXES);
const PYTHON_CONDA_PREFIX_PATTERN = createRegexAlternation(VERSION_COMPARISON_PREFIXES);

export const PYTHON_RUNTIME_DEPENDENCY_NAME = "python";

export const PYTHON_MANIFEST_TYPES = {
  CONDA: "conda",
  PIPFILE: "pipfile",
  PYPROJECT: "pyproject",
  REQUIREMENTS: "requirements",
} as const;

export const PYTHON_PATTERNS = {
  REQUIREMENT_LINE: new RegExp(`^([a-zA-Z0-9_.-]+)(${PYTHON_REQUIREMENT_PREFIX_PATTERN})([0-9.]+)`),
  COMMENT: /^#/,
  POETRY_DEPS: /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/,
  POETRY_LINE: /^([a-zA-Z0-9_.-]+)\s*=\s*"([^"]+)"/,
  PIPFILE_PACKAGES: /\[packages\]([\s\S]*?)(?=\[|$)/,
  PIPFILE_LINE: /^([a-zA-Z0-9_.-]+)\s*=\s*"([^"]+)"/,
  PYPROJECT_ARRAY_START: /^\s*([a-zA-Z0-9_.-]+)\s*=\s*\[/,
  PYPROJECT_DEPENDENCIES_START: /^\s*dependencies\s*=\s*\[/,
  PYPROJECT_QUOTED_DEPENDENCY: /"([^"]+)"/g,
  PYPROJECT_SECTION: /^\s*\[([^\]]+)\]\s*$/,
  CONDA_DEPENDENCIES_SECTION: /^\s*dependencies:\s*$/,
  CONDA_TOP_LEVEL_SECTION: /^\S.*:\s*$/,
  CONDA_DEPENDENCY_ITEM: /^(\s*)-\s+(.+)$/,
  CONDA_DEPENDENCY_LINE: new RegExp(
    `^([a-zA-Z0-9_.-]+)(${PYTHON_CONDA_PREFIX_PATTERN})([^\\s#]+)(.*)$`,
  ),
  PACKAGE_NAME: /^[a-zA-Z0-9_.-]+$/,
  PIP_VERSIONS: /Available versions:\s*(.+)/,
  CONDA_VERSION: /^([0-9.]+)/,
};

export type PythonManifestType = (typeof PYTHON_MANIFEST_TYPES)[keyof typeof PYTHON_MANIFEST_TYPES];
export type PythonPackageManager =
  (typeof PYTHON_PACKAGE_MANAGERS)[keyof typeof PYTHON_PACKAGE_MANAGERS];

export { CONDA_MANIFEST_FILES, MANIFEST_FILES, PYTHON_PACKAGE_MANAGERS };
