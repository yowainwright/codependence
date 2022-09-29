<p align="center"><a href="https://github.com/yowainwright/codependence"><img width="150" src="https://user-images.githubusercontent.com/1074042/193081452-bf69df80-ad1e-4a81-8595-00f65d7ad5dc.svg" alt="codependence"></a></p>

---

# [Codependence](https://www.npmjs.com/package/codependence) 🤼‍♀️

![Typed with TypeScript](https://flat.badgen.net/badge/icon/Typed?icon=typescript&label&labelColor=blue&color=555555)
[![npm version](https://badge.fury.io/js/codependence.svg)](https://badge.fury.io/js/pastoralist)
![ci](https://github.com/yowainwright/codependence/actions/workflows/ci.yml/badge.svg)
[![Github](https://badgen.net/badge/icon/github?icon=github&label&color=grey)](https://github.com/yowainwright/codependence)
![Twitter](https://img.shields.io/twitter/url?url=https%3A%2F%2Fgithub.com%2Fyowainwright%2Fcodependence)

#### Stop wresting with your code dependencies. Use Codependence!

**Codependence** is a JavaScript utility for checking dependencies to ensure they're up-to-date or match a specified version.

---

## Main usecase for Codependence

#### Keeps dependencies up-to-date

Codependence updates `package.json`'s dependencies based on a "codependencies" array of dependency names

---

#### Keeps dependencies pinned

Codependence keeps specified dependencies \*pinned

#### \*yes, dependencies can be pinned to `~` or `^` versions in `package.json` files

---
## Why use Codependence?

**Codependence** is a utility tool focused on a single task—managing specified dependency versions!

- It is built to work along side tools (like Dependabot) but it [can also manage dependencies fully](https://github.com/yowainwright/codependence-cron)!
- It handles monorepos child package dependencies _with ease_ and **without** package manager bias!
- It is as immediate as you want it to be, via [npm install scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts#npm-install) and build pipeline tools, such as [Husky](https://typicode.github.io/husky/)
- It can be run along with npm scripts or in github actions

---
## Why _not_ use Codependence?

**Codependence** isn't for everybody or every repository. Here are some reasons why it _might not_ be for you!

- You don't need intricate dependency version management
- You prefer specifying necessary dependencies with `latest`, or manually `pinning`, or using a tool like [Dependabot's ignore spec](https://github.blog/changelog/2021-05-21-dependabot-version-updates-can-now-ignore-major-minor-patch-releases/) within a `dependabot.yml`.

---

## Synopsis

Codependence is a JavaScript utility CLI and node tool that compares a `codependencies` array against `package.json` `dependencies`, `devDependencies`, and `peerDependencies` for \***codependencies**.

For each dependency included in the `codependencies` array, Codependence will either **a)** check that versions are at `latest` or **b)** Check that a specified version is matched within `package.json` files. Codependence can either **a)** return a pass/fail result _or_ **b)** update dependencies, devDependencies, and peerDependencies, in package.json file(s).

---

Codependence is useful for ensuring specified dependencies are up-to-date—or at a specified version within a project's `package.json` files(s)!

This utility is built to work alongside dependency management tools like [dependabot](https://dependabot.com/). It _could_ work instead of dependency management tool but is built for managing specific dependency versions vs _all_ dependencies.

---

#### \*Codependencies: are project dependencies which **must be** up-to-date or set to a specific version!

In example, if your repository requires the latest version and `latest` can't be specified as the dependency version within your `package.json`, Codependence will ensure your `package.json` has the **actual latest semver version** set in your `package.json`. It can/will do the same if an exact version is specified!

---

## Using Codependence

**Codependence** can be used as a standalone CLI, in npm scripts or, secondarily, as node utility.

#### Install

```sh
npm install codependence --save-dev
```

#### Quick setup

Pure CLI quick run

```sh
codependence --condependencies 'fs-extra' 'lodash'
```

Or use it with a config in the root `package.json` file

```ts
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

## Using Codependence as a CLI

**Codependence** is built as a CLI-first, set-it-and-forget-it tool.

It is recommendeded to install and setup **Codependence** as a `devDependency` within your root `package.json` and use a `codependence.codependencies` array to define dependencies you need to keep updated or pinned to a specific version.

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

## Using Codependence in Node

Although, **Codependence** is built to primarily be a CLI utility, it can be used as a node utility.

```ts
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

## Codependence Configuration Options

Codependence **options** can be used via CLI options, a config file read from the CLI, or with node by passing them into exported Codependence functions. Read more below!

---

### `codependencies`: `Array<string | Record<string, string>`

A **required** option or *config array! **Codependencies** are required via being passed in an array as a cli option **or as within a `codependence.codependencies` array.

- The default value is `undefined`
- An array is required!

---

#### \*Config Array Detail

The Codependence `codependencies` array supports `latest` like so, `["fs-extra", "lodash"]`. It will also match a specified version, like so `[{ "foo": "1.0.0" }]` and `[{ "foo": "^1.0.0" }]` or `[{ "foo": "~1.0.0" }]`.
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

### `yarnConfig`: `boolean`

An **optional** boolean value used to enable \***yarn config** checking
- The default value is `false`

---

## Demos 

Check out Codependence in Action!

- **[Codependence Cron](https://github.com/yowainwright/codependence-cron):** Codependence running off a Github Action cron job.
- **[Codependence Monorepo](https://github.com/yowainwright/codependence-monorepo):** Codependence monorepo example.

---

## Codependence Debugging

### `private packages`

If there is a `.npmrc` file, there is no issue with **Codependence** monitoring private packages. However, if a yarn config is used, Codependence must be instructed to run `version` checks differently.

---

#### Fixes

- With the CLI, add the `--yarnConfig` option.
- With node, add `yarnConfig: true` to your options or your config.
- For other private package issues, submit an [issue](https://github.com/yowainwright/codependence/issues) or [pull request](https://github.com/yowainwright/codependence/pulls).



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

Thanks to [Dev Wells](https://github.com/devdumpling) and [Steve Cox](https://github.com/stevejcox) for the aligned code leading to this project. Thanks to [Will Jacobson](https://github.com/willzjacobson) for discussing the documentation and language of this project.

---

Made by [@yowainwright](https://github.com/yowainwright), MIT 2022
