import type { OptionDefinition } from "./types";

export const OPTION_DEFINITIONS: OptionDefinition[] = [
  { flags: ["-t", "--isTestingCLI"], hasValue: false },
  { flags: ["--isTesting"], hasValue: false },
  { flags: ["-f", "--files"], hasValue: true, isArray: true },
  { flags: ["-u", "--update"], hasValue: false },
  { flags: ["-r", "--rootDir"], hasValue: true },
  { flags: ["-i", "--ignore"], hasValue: true, isArray: true },
  { flags: ["--debug"], hasValue: false },
  { flags: ["--silent"], hasValue: false },
  { flags: ["-v", "--verbose"], hasValue: false },
  { flags: ["-q", "--quiet"], hasValue: false },
  { flags: ["--cds", "--codependencies"], hasValue: true, isArray: true },
  { flags: ["-c", "--config"], hasValue: true },
  { flags: ["-s", "--searchPath"], hasValue: true },
  { flags: ["-y", "--yarnConfig"], hasValue: false },
  { flags: ["--permissive"], hasValue: false },
  { flags: ["-l", "--language"], hasValue: true },
  { flags: ["-h", "--help"], hasValue: false },
  { flags: ["--dry-run"], hasValue: false },
  { flags: ["--interactive"], hasValue: false },
  { flags: ["--watch"], hasValue: false },
  { flags: ["--no-cache"], hasValue: false },
  { flags: ["--format"], hasValue: true },
  { flags: ["--output-file"], hasValue: true },
];

export const HELP_TEXT = `
Codependence - Manage dependency versions across your project

Usage: codependence [command] [options]

Commands:
  init [type]                       Initialize codependence configuration
                                    Types: rc, package, default

Options:
  -t, --isTestingCLI               Enable CLI only testing
  --isTesting                       Enable running fn tests w/o overwriting
  -f, --files [files...]           File glob pattern
  -u, --update                      Update dependencies based on check
  -r, --rootDir <rootDir>          Root directory to start search
  -i, --ignore [ignore...]         Ignore glob pattern
  --debug                           Enable debugging
  --silent                          Enable mainly silent logging
  -v, --verbose                     Enable verbose logging (shows debug info)
  -q, --quiet                       Suppress all output except errors
  --cds, --codependencies [deps...] Dependencies to check
  -c, --config <config>            Path to a config file
  -s, --searchPath <searchPath>    Path to do a config file search
  -y, --yarnConfig                  Enable yarn config support
  --permissive                      Update all deps to latest except those in codependencies
  -l, --language <lang>            Target language (nodejs, go, python)
  -h, --help                        Show this help message
  --dry-run                         Show what would change without modifying files
  --interactive                     Choose which packages to update interactively
  --watch                           Watch for changes and re-check continuously
  --no-cache                        Disable version caching for fresh results
  --format <type>                   Output format: json, markdown, or table (default: table)
  --output-file <path>              Write output to file instead of stdout

Examples:
  # Get started
  codependence init                           Interactive setup wizard
  codependence init rc                        Create .codependencerc with all deps pinned

  # Check and update
  codependence                                Check for outdated dependencies
  codependence --update                       Update all dependencies to latest
  codependence --update --dry-run             Preview changes without modifying files

  # Permissive mode (update all except pinned)
  codependence --permissive --update          Update all deps except those in config
  codependence --permissive --codependencies react lodash --update
                                              Pin react & lodash, update everything else

  # Selective updates
  codependence --codependencies react vue --update
                                              Only update react and vue
  codependence --update --interactive         Choose which packages to update

  # Monorepo & multi-language
  codependence --files '**/package.json'      Update all package.json files in monorepo
  codependence --language python              Check Python requirements.txt/pyproject.toml
  codependence --language go                  Check Go go.mod dependencies

  # Development
  codependence --watch                        Watch mode - check every 30 seconds
  codependence --verbose                      Show performance metrics and cache stats
  codependence --no-cache                     Bypass cache for fresh results

  # Output formats (useful for CI/CD)
  codependence --format json                  Output as JSON for programmatic use
  codependence --format markdown              Output as Markdown for PR comments
  codependence --format json --output-file deps.json
                                              Save JSON output to file
`;

export const ARGS_START_INDEX = 2;
