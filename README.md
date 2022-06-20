# Codependence 🤼‍♀️

**Codependence** is a JavaScript utility CLI or node tool for checking dependencies in a project to ensure dependencies are up-to-date or match specified version(s).

##### Main usecase

- Keeps dependencies up-to-date—specifically for monorepos, internal release management, and dependency pinning.

##### Why? What about dependabot and others?

- **Codependence** handles monorepos child dependency with ease and without bias! ✅
- **Codependence** is immediate, via a [npm install scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts#npm-install) and build pipeline tools, such as [Husky](https://typicode.github.io/husky/) ✅
- **Codependence** can be run along with npm scripts or in github actions. ✅

---

##### Section Links

**[💭 &nbsp;Synopsis](#synopsis)** | **[🛠 &nbsp;Usage](#usage)** | **[📦 &nbsp;Install](#install)** | **[ 🏎 &nbsp;Quick Setup](#quick-setup)** | **[🚀&nbsp;CLI](#cli)** | **[🔩&nbsp;Node](#node)**

**[⚖️ &nbsp;Options](#options)** | **[🤼‍♀️ &nbsp;Codependencies](#codependencies-arraystring--recordstring-string)** | **[🤝 &nbsp;Contributing](#contributing)** | **[🗺 &nbsp;Roadmap](#roadmap)**

---

## Synopsis

**Codependence** is a JavaScript utility that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***codependencies** which are not up-to-date or a specific version. Codependence can return a pass/fail result or update specified \***codependencies**.

This utility is useful for ensuring dependencies are always up-to-date—or installed at a specified version!

This utility can work alongside dependency management tools like [dependabot](https://dependabot.com/) or instead of them depending on your requirements.

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

---

##### Option Links

**[🤼‍♀️ &nbsp; Codependencies](#codependencies-arraystring--recordstring-string)**&nbsp; | **[🗂 &nbsp; Files](#files-arraystring)**&nbsp; | **[🦷 &nbsp; rootDir](#rootdir-string)**&nbsp; | **[ &nbsp; ignore](#ignore-arraystring)**&nbsp; | **[ 🐛 &nbsp; debug](#debug)**&nbsp; | **[🤫 &nbsp; silent](#silent)**&nbsp;| **[⚖️ &nbsp; config](#config-string)**&nbsp; | **[🔦 &nbsp; SearchPath](#searchpath-string)**

---

### `codependencies`: `Array<string | Record<string, string>`

A **required** option or config array! **Codependencies** are required via being passed in an array as a cli option **or as within a `codependence.codependencies` array.
- The default value is `undefined`
- An array is required!

---

#### Option Details

Codependencies provide options to enhance your capability to control dependency updates.

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

Although, generally, it is easiest to use array of strings for `codedependencies` like so, `["fs-extra", "lodash"]`, it is also possible to use object items, like so `[{ "foo": "1.0.0" }]`. This is built in to give you more capability to control your dependencies!

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
  - add more uniform logging utility function (will be done asap)
  - add better spying (in progress)
- **Demo Repos**
  - **monorepo:** present how **codependence** can work to support monorepo updates (in progress)
  - **cron:** present how github action cron can work with **codependence**
  - **cadence;** present how cadence can be implemented with **codependence**
- **Documentation**
  - write recipes section after the demo repos are complete

---

## Shoutouts

Thanks to [Dev Wells](https://github.com/devdumpling) and [Steve Cox](https://github.com/stevejcox) for the aligned code leading to this project. Thanks [Gabriel Diaz](https://github.com/GaboFDC) for working on the project which uses Codependence with me. Thanks to [Will Jacobson](https://github.com/willzjacobson) for discussing the documentation and language of this project.

---

Made by [@yowainwright](https://github.com/yowainwright) for fun with passion! 🐝
