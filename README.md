<h1><a href="https://www.npmjs.com/package/codependence" target="_blank">Codependence</a></h1>

![Typed with TypeScript](https://flat.badgen.net/badge/icon/Typed?icon=typescript&label&labelColor=blue&color=555555)
[![npm version](https://badge.fury.io/js/codependence.svg)](https://badge.fury.io/js/codependence)
![ci](https://github.com/yowainwright/codependence/actions/workflows/ci.yml/badge.svg)
[![Github](https://badgen.net/badge/icon/github?icon=github&label&color=grey)](https://github.com/yowainwright/codependence)
![Twitter](https://img.shields.io/twitter/url?url=https%3A%2F%2Fgithub.com%2Fyowainwright%2Fcodependence)

#### Stop wrestling with your code dependencies. Use Codependence!

**Codependence** is a JavaScript utility for checking dependencies to ensure they're up-to-date or match a specified version.

---

## _Main Usecase_

#### Keep dependencies up-to-date

Codependence updates `package.json`'s dependencies based on a "codependencies" array of dependency names.
The difference from `{npm,pnpm} update` or `yarn upgrade` is Codependence _allows you to pin what you want and update the rest_!
Furthermore, Codependence works with monorepos and is package manager agnostic.

#### \*yes, dependencies can be pinned to `~` or `^` versions in `package.json` files!

Readme more about [Codependence](#synopsis) why you might want to use it [below](#why-use-codependence)!

---

## Usage

**Codependence** can be used as a standalone CLI, in npm scripts or, secondarily, as node utility!

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

## Codependence as a CLI

**Codependence** is built as a CLI-first, set-it-and-forget-it tool.

It is recommendeded to install and setup **Codependence** as a `devDependency` within your root `package.json` and use a `codependence.codependencies` array to define dependencies you need to keep updated or pinned to a specific version.

Furthermore, you can add a `codependence.codependencies` array to child packages' `package.json` in your monorepo to ensure specific dependencies are pinned to a specific versions within your monorepo packages.

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

## Codependence in Node

Although, **Codependence** is built to primarily be a CLI utility, it can be used as a node utility.

```ts
import codependence from 'codependence'

const checkForUpdate = async () => {
  const isLatest = await codependence({ codependencies: ['fs-extra', 'lodash'] })
  if (!isLatest) {
    console.log('This repo is update-to-date')
  } else {
    console.error('This repo is not update-to-date')
  }
}
checkForUpdate()
```

## Configuration Options

Codependence **options** can be used via CLI options, a config file read from the CLI, or with node by passing them into exported Codependence functions. Read more below!

---

### `codependencies`: `Array<string | Record<string, string>`

A **required** option or \*config array! **Codependencies** are required via being passed in an array as a cli option \*\*or as within a `codependence.codependencies` array.

- The default value is `undefined`
- An array is required!

---

### \*Config Array Detail

The Codependence `codependencies` array supports `latest` out-of-the-box.

> So having this `["fs-extra", "lodash"]` will return the `latest` versions of the packages within the array. It will also match a specified version, like so `[{ "foo": "1.0.0" }]` and `[{ "foo": "^1.0.0" }]` or `[{ "foo": "~1.0.0" }]`. You can also include a `*` **at the end** of a name you would like to match. For example, `@foo/*` will match all packages with `@foo/` in the name and return their latest versions. This will also work with `foo-*`, etc.

**Codependence** is built in to give you more capability to control your dependencies!

---

### Using the `codependence.codependencies` array in Monorepo child packages

You can add a `codependence.codependencies` array to child packages in your monorepo to ensure specific dependencies are pinned to a specific different versions within your monorepo packages.

#### For example

You can have a `package.json` file in a `@foo/bar` package with following:

```typescript
{
  "name": "@foo/bar",
  "dependencies": {
    "fs-extra": "^9.0.0",
  },
  "codependence": {
    "codependencies": [{ "fs-extra": "^9.0.0" }]
  }
}

```

And another `package.json` file in a `@foo/baz` package with following:

```typescript
{
  "name": "@foo/baz",
  "dependencies": {
    "fs-extra": "^11.1.0",
  },
  "codependence": {
    "codependencies": [{ "fs-extra": "^11.1.0" }]
  }
}

```

Codependencies will install the right dependency version for each package in your monorepo!

> _**Note:** Codependencies can and will still install the expected version defined at the monorepo's root for packages that don't specify differences in their `package.json` files!_

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

## Recipes

Listed below are some common patterns (recipes) for using **Codependence**.

### Don't want a config? No problem!

Starting out, you may not want a config object. Have no fear, **Codependence** can be used as a CLI utility ONLY!

```sh
codependence --codependencies 'lodash' '{ \"fs-extra\": \"10.0.1\" }'
```

### Want to grab all dependencies which match a `<name>*` (name star) pattern to return the latest version of them? Sure!

```sh
codependence --codependencies '@foo/*' --update
```

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

## Demos

Check out Codependence in Action!

- **[Codependence Cron](https://github.com/yowainwright/codependence-cron):** Codependence running off a Github Action cron job.
- **[Codependence Monorepo](https://github.com/yowainwright/codependence-monorepo):** Codependence monorepo example.

---

## Codependence Debugging

### `private packages`

If there is a `.npmrc` file, there is no issue with **Codependence** monitoring private packages. However, if a yarn config is used, Codependence must be instructed to run `version` checks differently.

---

### Fixes

- With the CLI, add the `--yarnConfig` option.
- With node, add `yarnConfig: true` to your options or your config.
- For other private package issues, submit an [issue](https://github.com/yowainwright/codependence/issues) or [pull request](https://github.com/yowainwright/codependence/pulls).

---

## Development Environment

This project uses:
- Node.js 23.0.0
- pnpm 10.9.0

We use [mise](https://mise.jdx.dev/) to manage tool versions. If you have mise installed, it will automatically use the correct versions of Node.js and pnpm.

### Setup with mise

```sh
# Install mise if you don't have it
curl https://mise.run | sh

# Clone the repository
git clone https://github.com/yowainwright/codependence.git
cd codependence

# mise will automatically use the correct versions from .mise.toml
mise install

# Install dependencies
pnpm install
```

### Setup without mise

```sh
# Install Node.js 23.0.0
nvm install 23.0.0

# Install pnpm 10.9.0
corepack enable
corepack prepare pnpm@10.9.0 --activate

# Install dependencies
pnpm install
```

## Contributing

[Contributing](.github/CONTRIBUTING.md) is straightforward.

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

Thanks to [Dev Wells](https://github.com/devdumpling) and [Steve Cox](https://github.com/stevejcox) for the aligned code leading to this project. Thanks [Navid](https://github.com/NavidK0) for some great insights to improve the api!

---

Made by [@yowainwright](https://github.com/yowainwright), MIT 2022
