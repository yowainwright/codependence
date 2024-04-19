#!/usr/bin/env node

import { program } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { logger, script } from './scripts'
import ora from 'ora'
import gradient from 'gradient-string'
import { Options, ConfigResult } from './types'

export async function action(options: Options = {}): Promise<void> {
  // capture config data
  const explorer = cosmiconfigSync('codependence')
  const result = options?.searchPath ? explorer.search(options.searchPath) : explorer.search()
  const { config: pathConfig = {} } = (options?.config ? explorer.load(options?.config) : {}) as ConfigResult

  // massage config and option data
  const updatedConfig = {
    ...(!Object.keys(pathConfig).length ? result?.config : {}),
    ...(pathConfig?.codependence ? { ...pathConfig.codependence } : pathConfig),
    ...options,
    isCLI: true,
  }

  // remove action level options
  const {
    config: usedConfig,
    searchPath: usedSearchPath,
    isTestingCLI,
    isTestingAction,
    ...updatedOptions
  } = updatedConfig

  // capture/test CLI options
  if (isTestingCLI) {
    console.info({ updatedOptions })
    return
  }

  // capture action unit test options
  if (isTestingAction) return updatedOptions

  try {
    if (!updatedOptions.codependencies) throw '"codependencies" is required'
    const spinner = ora(`🤼‍♀️ ${gradient.teen(`codependence`)} wrestling...\n`).start()
    await script(updatedOptions)
    spinner.succeed(`🤼‍♀️ ${gradient.teen(`codependence`)} pinned!`)
  } catch (err) {
    logger({
      type: 'error',
      section: 'cli:error',
      message: (err as string).toString(),
    })
  }
}

program
  .description(
    'Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date',
  )
  .option('-t, --isTestingCLI', 'enable CLI only testing')
  .option('--isTesting', 'enable running fn tests w/o overwriting')
  .option('-f, --files [files...]', 'file glob pattern')
  .option('-u, --update', 'update dependencies based on check')
  .option('-r, --rootDir <rootDir>', 'root directory to start search')
  .option('-i, --ignore [ignore...]', 'ignore glob pattern')
  .option('--debug', 'enable debugging')
  .option('--silent', 'enable mainly silent logging')
  .option('-cds, --codependencies [codependencies...]', 'deps to check')
  .option('-c, --config <config>', 'path to a config file')
  .option('-s, --searchPath <searchPath>', 'path to do a config file search')
  .option('-y, --yarnConfig', 'enable yarn config support')
  .action(action)
  .parse(process.argv)

export { program }
