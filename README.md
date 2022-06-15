# Codependence (WIP) 👯‍♂️

**Codependence, for code dependency.**

Codependence is a JavaScript utility tool for checking dependencies in a project to ensure dependencies are up-to-date or match specified version(s).

---

**[💭 &nbsp;Synopsis](#synopsis)** | **[🛠 &nbsp;Usage](#usage)** | **[📦 &nbsp;Install](#install)** | **[ 🏎 &nbsp;Quick Setup](#quick-setup)** | **[🚀&nbsp;CLI](#cli)** | **[🔩&nbsp;Node](#node)** | **[⚖️ &nbsp;Options](#options)**

**[🤼‍♀️ &nbsp;&nbsp;Codependencies](#codependencies)** | **[🤝 &nbsp;&nbsp;Contributing](#contributing)**

---

## Synopsis

Codependence is a JavaScript utility that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***codependencies** which are not up-to-date or a specific version. Codependence can return a pass/fail result or update specified \***codependencies**.

This utility is useful for ensuring **very dependent** dependencies are always up-to-date—or installed at a specified version.

This utility can be used in place of tools that do dependency management and, yes, it supports monorepos.

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
  -f, --files           file glob pattern
  -u, --update          update dependencies based on check
  -r, --rootDir            root directory to start search
  -i, --ignore          ignore glob pattern
  --debug               enable debugging
  --silent              enable mainly silent logging
  --addDeps             add codependents as dependencies
  --install             install codependents without saving
  -c, --codependencies  a path to a file with a codependenies object
  -h, --help            display help for command
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

Made by [@yowainwright](https://github.com/yowainwright) for fun with passion!
