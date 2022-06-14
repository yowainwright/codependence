# Codependence 👯‍♂️

**Codependence, for code dependency.**

Codependence is a JavaScript utility tool for checking dependencies in a project to ensure dependencies are up-to-date or match specified version(s).

---

**[💭 &nbsp;&nbsp;Synopsis](#synopsis)** | **[🛠 &nbsp;&nbsp;Usage](#usage)** | **[📦 &nbsp;&nbsp;Install](#install)** | **[ 🏎 &nbsp;&nbsp;Quick Setup](#quick-setup)** | **[🚀&nbsp;&nbsp;CLI](#cli)** | **[🔩&nbsp;&nbsp;Node](#node)** | **[⚖️&nbsp;&nbsp; Options](#options)**

**[🤼‍♀️ &nbsp;&nbsp;Codependencies](#codependencies)** | **[🤝 &nbsp;&nbsp;Contributing](#contributing)**

---

## Synopsis

Codependence is a JavaScript utility that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***codependencies** which are not up-to-date or a specific version. Codependence can return a pass/fail result or update specified \***codependencies**.

This utility is useful for ensuring very dependent dependencies are always up-to-date—or, at least, installed at a specified version.

> \***Codependencies:** are project dependencies which **must be** up-to-date or set to a specific version!
> In example, if your repository requires the latest version and `latest` can't be specified as the dependency version within your `package.json`, Codependence will ensure your `package.json` has the actual latest semver version set in your `package.json`. It can/will do the same if an exact version is specified!

---

## Usage

**Codependence** can be used as a standalone CLI, in npm scripts or as node utility.
##### Install

```sh
npm install codependence --save-dev
```

##### Quick setup

Pure CLI quick run

```sh
codependence --condependencies 'fs-extra' 'lodash'
```

Or use with a config in the root `package.json` file

```json
{
  "codependence": {
    "condependencies": ["fs-extra", "lodash"]
  },
  "scripts": {
    "update-codependencies": "codependence --update",
    "prepare": "npm run update-codependencies"
  }
}

```

---

### CLI

**Codependence** built as a CLI first, set it and forget it tool.

It is recommended to install and setup **Codependence** as a `devDependency` within your root `package.json` using a `codependence.codependencies` array to define code you need to keep updated or specced to a specific version.

```sh
Usage: program [options]

Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date

Options:
  -t, --isTestingCLI    enables CLI testing, no scripts are run
  -f, --files           file glob pattern
  -u, --update          update dependencies based on check
  -r, --root            root directory to start search
  -i, --ignore          ignore glob pattern
  --debug               enable debugging
  --silent              enable mainly silent logging
  --addDeps             add codependents as dependencies
  --install             install codependents without saving
  -c, --codependencies  a path to a file with a codependenies object
  -h, --help            display help for command
```

### Node

```js

```

## Options


## Examples
