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

Examples:
  codependence --update             Update all dependencies
  codependence --config .codependencerc
  codependence init                 Interactive setup
  codependence --language go        Use Go provider
`;

export const ARGS_START_INDEX = 2;
