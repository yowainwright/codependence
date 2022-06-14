# Codependence 👯‍♂️

**Codependence, for code dependency. Because sometimes, even if it shouldn't be, code dependency is required.**

Codependence is a JavaScript utility tool for checking dependencies in a project to ensure dependencies are up-to-date or match specified version(s).

---

**[Synopsis](#synopsis)** | **[Usage](#usage)** | **[CLI](#cli)** | **[Node](#node)** | **[Options](#options)** |

---

## Synopsis

Codependence is a JavaScript utility that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***"codependencies"** which are not up-to-date or a specific version. Codependence can return a pass/fail result or update specified \***"codependencies"**.

This utility is useful for ensuring very dependent dependencies are always up-to-date—or, at least, installed at a specified version.

> \***codependencies** are project dependencies which **must be** up-to-date or set to a specific version

## Usage

Quick setup

```sh
npm i codependence -D
```

Pass in codependence manually

```sh
codependence -c 'fs-extra' 'lodash'
```

Or with a `codependence` config in the root `package.json` file

```sh
codependence
```

Read below for all of the CLI options

### CLI

```sh

```

### Node

```js

```

## Options


## Examples
