export const PYTHON_PATTERNS = {
  REQUIREMENT_LINE: /^([a-zA-Z0-9_-]+)(==|>=|<=|~=|>|<)([0-9.]+)/,
  COMMENT: /^#/,
  POETRY_DEPS: /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/,
  POETRY_LINE: /^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/,
  PIPFILE_PACKAGES: /\[packages\]([\s\S]*?)(?=\[|$)/,
  PIPFILE_LINE: /^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/,
  PACKAGE_NAME: /^[a-zA-Z0-9_-]+$/,
  PIP_VERSIONS: /Available versions:\s*(.+)/,
  CONDA_VERSION: /^([0-9.]+)/,
};

export type PythonManifestType =
  | "requirements"
  | "pyproject"
  | "pipfile"
  | "conda";
export type PythonPackageManager = "pip" | "poetry" | "pipenv" | "conda" | "uv";
