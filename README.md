# Codependence 🤼‍♀️

**Codependence** is a JavaScript utility CLI or node tool for checking specified dependencies in a project to ensure dependencies are up-to-date or match a specified version within `package.json` file(s).

---

##### Main usecase

- Keeps dependencies up-to-date
  - **Codependence** updates `package.json`'s dependencies based on a **"codependencies"** array of dependency names
- Keeps dependencies pinned
  - **Codependence** keeps specified dependencies pinned (yes, dependencies can be pinned to `~` or `^` versions) in `package.json` files

---
##### Why?

- **Codependence** is a utility tool focused on a single task (managing specified dependency versions). It is built to work along side tools like Dependabot but it [can also manage dependencies fully](https://github.com/yowainwright/codependence-cron)! ✅
- **Codependence** handles monorepos child package dependencies with ease and **without** package manager bias! ✅
- **Codependence** is as immediate as you want it to be, via [npm install scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts#npm-install) and build pipeline tools, such as [Husky](https://typicode.github.io/husky/) ✅
- **Codependence** can be run along with npm scripts or in github actions ✅

---
##### Why _not_?

- You don't need intricate dependency version management ❌
- You prefer specifying necessary dependencies with `latest`, or manually `pinning`, or using a tool like [Dependabot's ignore spec](https://github.blog/changelog/2021-05-21-dependabot-version-updates-can-now-ignore-major-minor-patch-releases/) within a `dependabot.yml`. ❌

---

##### Section Links

**[💭 &nbsp;Synopsis](#synopsis)** | **[🛠 &nbsp;Usage](#usage)** | **[📦 &nbsp;Install](#install)** | **[ 🏎 &nbsp;Quick Setup](#quick-setup)** | **[🚀&nbsp;CLI](#cli)** | **[🔩&nbsp;Node](#node)**

**[⚖️ &nbsp;Options](#options)** | **[🤼‍♀️ &nbsp;Codependencies](#codependencies-arraystring--recordstring-string)** | **[👌&nbsp;Codependencies Array](#array-types)**

**[🖼 &nbsp;Demos](#demos)** | **[🤝 &nbsp;Contributing](#contributing)** | **[🗺 &nbsp;Roadmap](#roadmap)**

---

## Synopsis

**Codependence** is a JavaScript utility CLI and node tool that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***codependencies**. For each dependency included in the array, **Codependence** will either a) check that versions are at `latest` or b) check that a specified version is matched within `package.json` files. **Codependence** can either return a) a pass/fail result _or_ b) update dependencies, devDependencies, and peerDependencies, in package.json file(s).

This utility is useful for ensuring specified dependencies are up-to-date—or at a specified version within a project's `package.json` files(s)!

This utility is built to work alongside dependency management tools like [dependabot](https://dependabot.com/). It _could_ work instead of dependency management tool but is built for managing specific dependency versions vs _all_ dependencies.

---

##### \*Codependencies: are project dependencies which **must be** up-to-date or set to a specific version!

In example, if your repository requires the latest version and `latest` can't be specified as the dependency version within your `package.json`, Codependence will ensure your `package.json` has the **actual latest semver version** set in your `package.json`. It can/will do the same if an exact version is specified!

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

**Codependence** is built as a CLI first, set-it and forget-it tool.

It is recommended to install and setup **Codependence** as a `devDependency` within your root `package.json` using a `codependence.codependencies` array to define code you need to keep updated or specced to a specific version.

```sh
Usage: program [options]

Codependency, for code dependency. Checks `codependencies` in package.json files to ensure dependencies are up-to-date

Options:
  -f, --files [files...]                      file glob pattern
  -u, --update                                update dependencies based on check
  -r, --rootDir <rootDir>                     root directory to start search
  -i, --ignore [ignore...]                    ignore glob pattern
  --debug                                     enable debugging
  --silent                                    enable mainly silent logging
  -cds, --codependencies [codependencies...]  a path to a file with a codependenies object
  -c, --config <config>                       accepts a path to a config file
  -s, --searchPath <searchPath>               a search path string for locationing config files
  -h, --help                                  display help for command
```

### Node

Although, **Codependence** is built to primarily be a CLI utility, it can be used as a node utility.

```js
import codependence from 'codependence';

const checkForUpdate = async () => {
  const isLatest = await codependence({ codependencies: ['fs-extra', 'lodash'] });
  if (!isLatest) {
    console.log('This repo is update-to-date');
  } else {
    console.error('This repo is not update-to-date');
  }
}
checkForUpdate();
```

## Options

Listed below are all the options which can be used with **Codependence**.

Options can be used via CLI options, a config file read from the CLI, or with node by passioning them into the exported functions. Read more below!

---

##### Option Links

**[🤼‍♀️ &nbsp; Codependencies](#codependencies-arraystring--recordstring-string)**&nbsp; | **[🗂 &nbsp; Files](#files-arraystring)**&nbsp; | **[🦷 &nbsp; rootDir](#rootdir-string)**&nbsp; | **[😌 &nbsp; ignore](#ignore-arraystring)**

**[ 🐛 &nbsp; debug](#debug)**&nbsp; | **[🤫 &nbsp; silent](#silent)**&nbsp;| **[⚖️ &nbsp; config](#config-string)**&nbsp; | **[🔦 &nbsp; SearchPath](#searchpath-string)**

---

### `codependencies`: `Array<string | Record<string, string>`

A **required** option or config array! **Codependencies** are required via being passed in an array as a cli option **or as within a `codependence.codependencies` array.
- The default value is `undefined`
- An array is required!

---

#### Option Details

**Codependence** provide options to enhance your capability to control dependency updates.

##### CLI Example

```sh
codependence --codependencies 'fs-extra' 'lodash'
```

##### Config Example

```json
{
  "codependence": {
    "codependencies": ["fs-extra", "lodash", { "foo": "1.0.0" }]
  },
  "scripts": {
    "check-dependencies": "codpendence",
    "prepare": "npm run check-dependencies",
    "update-dependencies": "codependence --update",
    "update": "npm run update-codependencies"
  }
}
```

##### Array Types

**Codependence** `codependencies` supports `latest` like so, `["fs-extra", "lodash"]`.
It will also match a specified version, like so `[{ "foo": "1.0.0" }]` and `[{ "foo": "^1.0.0" }]` or `[{ "foo": "~1.0.0" }]`.
**Codependence** is built in to give you more capability to control your dependencies!

---

### `files`: `Array<string>`

An **optional** array of strings to check for `package.json` files to update.
- The default value is `['package.json']`
- This array accepts glob patterns as well, example `["package.json", "**/package.json"`

---

### `update`: `boolean`

An **optional** boolean which defines whether **Codependence** should update dependencies in `package.json`'s or not.
- The default value is `false`

---

### `rootDir`: `string`

An **optional** string which can used to specify the root directory to run checks from;
- The default value is `"./"`

---

### `ignore`: `Array<string>`

An **optional** array of strings used to specify directories to ignore
- The default value is `["node_modules/**/*", "**/node_modules/**/*"]`
- glob patterns are accepted

---

### `debug`: `boolean`

An **optional** boolean value used to enable debugging output
- The default value is `false`

---

### `silent`: `boolean`

An **optional** boolean value used to enable a more silent developer experience
- The default value is `false`

---

### `config`: `string`

An **optional** string containing a package to file which contains `codependence` config.
- The default is `undefined`

---
### `searchPath`: `string`

An **optional** string containing a search path for location config files.
- The default value is `undefined`

---

## Demos

- **[Codependence Cron](https://github.com/yowainwright/codependence-cron):** Codependence running off a Github Action cron job.

---

## Contributing

[Contributing](.github/CONTRIBUTING.md) is straightforward.

### Setup

```sh
nvm install && npm install pnpm && pnpm install
```

### Issues

- Sprinkle some context
- Can you submit a pull request if needed?

### Pull Requests

- Add a test (or a description of the test) that should be added
- Update the readme (if needed)
- Sprinkle some context in the [pull request](.github/PULL_REQUEST_TEMPLATE.md).
- Hope it's fun!

Thank you!

---

## Roadmap

- **Code:**
  - add better spying/mocking (in progress)
  - add init cmd to cli
  - add utils functions to be executed with the cli cmd (monorepo, cadence, all deps)
- **Demo Repos**
  - **monorepo:** present how **codependence** can work to support monorepo updates (in progress)
  - **cadence:** present how cadence can be implemented with **codependence**
- **Documentation**
  - write recipes section after the demo repos are complete (in progress)

---

## Shoutouts

Thanks to [Dev Wells](https://github.com/devdumpling) and [Steve Cox](https://github.com/stevejcox) for the aligned code leading to this project. Thanks [Gabriel Diaz](https://github.com/GaboFDC) for working on the project which uses Codependence with me. Thanks to [Will Jacobson](https://github.com/willzjacobson) for discussing the documentation and language of this project.

---

Made by [@yowainwright](https://github.com/yowainwright) for fun with passion! 🐝
