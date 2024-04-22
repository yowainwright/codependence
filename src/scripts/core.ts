import { readFileSync, writeFileSync } from 'fs'
import { execa } from 'execa'
import fg from 'fast-glob'
const { sync: glob } = fg
import { logger, writeConsoleMsgs } from './utils'
import {
  CheckFiles,
  ConstructVersionMapOptions,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
} from '../types'

/**
 * constructVersionMap
 * @description constructs a map of each item in a codependencies array
 * @param {codependencies} array
 * @param {exec} fn
 * @param {isDebugging} boolean
 * @returns {object}
 */
export const constructVersionMap = async ({
  codependencies,
  exec = execa,
  debug = false,
  yarnConfig = false,
  isTesting = false,
}: ConstructVersionMapOptions) => {
  const updatedCodeDependencies = await Promise.all(
    codependencies.map(async (item) => {
      try {
        if (typeof item === 'object' && Object.keys(item).length === 1) {
          return item
        } else if (typeof item === 'string' && item.length > 1 && !item.includes(' ')) {
          // the following 2 lines capture only accepted npm package names
          const isModuleSafeCharacters = /^[A-Za-z0-9\-_.]+$/.test(item)
          if (!isModuleSafeCharacters) throw 'invalid item'
          const runner = !yarnConfig ? 'npm' : 'yarn'
          const cmd = !yarnConfig
            ? ['view', item, 'version', 'latest']
            : ['npm', 'info', item, '--fields', 'version', '--json']
          const { stdout = '' } = (await exec(runner, cmd)) as unknown as Record<string, string>

          const version = !yarnConfig ? stdout.replace('\n', '') : JSON.parse(stdout.replace('\n', ''))?.version
          if (version) return { [item]: version }
          throw `${version}`
        } else {
          throw 'invalid item'
        }
      } catch (err) {
        if (debug)
          logger({
            type: 'error',
            section: `constructVersionMap`,
            message: (err as string).toString(),
            isDebugging: debug,
          })
        logger({
          type: 'error',
          section: `constructVersionMap`,
          message: `there was an error retrieving ${item}`,
        })
        console.error(`🤼‍♀️ => Is ☝️ a private package? Does that name look correct? 🧐`)
        console.error(
          `🤼‍♀️ => Read more about configuring dependencies here: https://github.com/yowainwright/codependence#debugging`,
        )
        if (isTesting) return {}
        process.exit(1)
      }
    }),
  )
  const versionMap = updatedCodeDependencies.reduce(
    (acc: Record<string, string> = {}, item: Record<string, string>) => {
      const [name] = Object.keys(item)
      const version = item?.[name]
      return { ...acc, ...(name && version ? { [name]: version } : {}) }
    },
    {},
  )
  return versionMap
}

/**
 * constructVersionTypes
 * @description constructs an object with a bumpVersion and exactVersion
 * @param {version} string
 * @returns {object}
 */
export const constructVersionTypes = (version: string): Record<string, string> => {
  const versionCharacters = version.split('')
  const [firstCharacter, ...rest] = versionCharacters
  const specifier = ['^', '~'].includes(firstCharacter) ? firstCharacter : ''
  const hasSpecifier = specifier.length === 1
  const characters = rest.join('')
  const exactVersion = hasSpecifier ? characters : version
  const bumpVersion = version
  return {
    bumpCharacter: specifier,
    bumpVersion,
    exactVersion,
  }
}

/**
 * constructDepsToUpdateList
 * @description returns an array of deps to update
 * @param {dep} object
 * @param {versionMap} object
 * @returns {array} example [{ name: 'foo', action: '1.0.0', expected: '1.1.0' }]
 */
export const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>,
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return []
  const versionList = Object.keys(versionMap)
  return Object.entries(dep)
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter, bumpVersion } = constructVersionTypes(version)
      return { name, exactVersion, bumpCharacter, bumpVersion }
    })
    .filter(({ name, exactVersion }) => versionList.includes(name) && versionMap[name] !== exactVersion)
    .map(({ name, bumpCharacter, bumpVersion }) => ({
      name,
      actual: bumpVersion,
      exact: versionMap[name],
      expected: `${bumpCharacter}${versionMap[name]}`,
    }))
}

/**
 * constructDeps
 * @description constructed deps with updates
 * @param {json} object
 * @param {depName} string
 * @param {depList} array
 * @returns {object}
 */
export const constructDeps = <T extends PackageJSON>(json: T, depName: string, depList: Array<DepToUpdateItem>) =>
  depList?.length
    ? depList.reduce(
        (
          newJson: PackageJSON['dependencies' | 'devDependencies' | 'peerDependencies'],
          { name, expected: version }: DepToUpdateItem,
        ) => {
          return {
            ...json[depName as keyof T],
            ...newJson,
            [name]: version,
          }
        },
        {},
      )
    : json[depName as keyof PackageJSON]

/**
 * constructJson
 * @description constructs json with updates
 * @param {json} object
 * @param {depsToUpdate} array
 * @param {isDebugging} boolean
 * @returns {object}}
 */
export const constructJson = <T extends PackageJSON>(json: T, depsToUpdate: DepsToUpdate, isDebugging = false) => {
  const { depList, devDepList, peerDepList } = depsToUpdate
  const dependencies = constructDeps(json, 'dependencies', depList)
  const devDependencies = constructDeps(json, 'devDependencies', devDepList)
  const peerDependencies = constructDeps(json, 'peerDependencies', peerDepList)
  if (isDebugging) {
    logger({
      type: 'debug',
      section: 'constructJson',
      isDebugging,
    })
    console.debug({
      dependencies,
      devDependencies,
      peerDependencies,
    })
  }
  return {
    ...json,
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
    ...(peerDependencies ? { peerDependencies } : {}),
  }
}

/**
 * checkDependenciesForVersion
 * @description checks dependencies for a mismatched version
 * @param {versionMap} object
 * @param {json} object
 * @param {isUpdating} boolean
 * @returns {boolean}
 */
export const checkDependenciesForVersion = <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
): boolean => {
  const { name, dependencies, devDependencies, peerDependencies } = json
  const { isUpdating, isDebugging, isSilent, isTesting } = options
  if (!dependencies && !devDependencies && !peerDependencies) return false
  const depList = constructDepsToUpdateList(dependencies, versionMap)
  const devDepList = constructDepsToUpdateList(devDependencies, versionMap)
  const peerDepList = constructDepsToUpdateList(peerDependencies, versionMap)
  if (isDebugging) {
    logger({
      type: 'debug',
      isDebugging,
      section: 'checkDependenciesForVersion',
    })
    console.debug({
      depList,
      devDepList,
      peerDepList,
    })
  }
  if (!depList.length && !devDepList.length && !peerDepList.length) {
    return false
  }
  if (!isSilent) Array.from([depList, devDepList, peerDepList], (list) => writeConsoleMsgs(name, list))
  if (isUpdating) {
    const updatedJson = constructJson(json, { depList, devDepList, peerDepList }, isDebugging)
    const { path, ...newJson } = updatedJson
    if (!isTesting) {
      writeFileSync(path, JSON.stringify(newJson, null, 2).concat('\n'))
    } else {
      logger({
        type: 'info',
        section: 'checkDependenciesForVersion:test-writeFileSync:',
        message: path,
      })
    }
  }
  return true
}

/**
 * checkMatches
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.files} array
 * @param {options.cwd} string
 * @param {options.isUpdating} boolean
 * @param {options.versionMap} object
 * @param {options.rootDir} string
 * @param {options.isDebugging} boolean
 * @param {options.isSilent} boolean
 * @param {options.isCLI} boolean
 * @param {options.isTesting} boolean
 * @returns {void}
 */
export const checkMatches = ({
  versionMap,
  rootDir,
  files,
  isUpdating = false,
  isDebugging = false,
  isSilent = true,
  isCLI = false,
  isTesting = false,
}: CheckMatches): void => {
  const packagesNeedingUpdate = files
    .map((file) => {
      const path = `${rootDir}${file}`
      const packageJson = readFileSync(path, 'utf8')
      const json = JSON.parse(packageJson)
      return { ...json, path }
    })
    .filter((json) =>
      checkDependenciesForVersion(versionMap, json, {
        isUpdating,
        isDebugging,
        isSilent,
        isTesting,
      }),
    )

  if (isDebugging) {
    logger({
      type: 'debug',
      section: 'checkMatches',
      isDebugging,
      message: 'see updates',
    })
    console.debug({ packagesNeedingUpdate })
  }

  const isOutOfDate = packagesNeedingUpdate.length > 0
  if (isOutOfDate && !isUpdating) {
    logger({
      type: 'error',
      message: 'Dependencies are not correct. 😞',
    })
    if (isCLI) process.exit(1)
  } else if (isOutOfDate) {
    logger({
      type: 'info',
      message: 'Dependencies were not correct but should be updated! Check your git status. 😃',
    })
  } else {
    logger({
      type: 'log',
      message: 'No dependency issues found! 👌',
    })
  }
}

/**
 * checkFiles
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.codependencies} array
 * @param {options.rootDir} string
 * @param {options.ignore} array
 * @param {options.update} boolean
 * @param {options.files} array
 * @param {options.rootDir} string
 * @param {options.debug} boolean
 * @param {options.silent} boolean
 * @param {options.isCLI} boolean
 * @param {options.isTesting} boolean
 * @returns {void}
 */
export const checkFiles = async ({
  codependencies,
  files: matchers = ['package.json'],
  rootDir = './',
  ignore = ['**/node_modules/**'],
  update = false,
  debug = false,
  silent = false,
  isCLI = false,
  yarnConfig = false,
  isTesting = false,
}: CheckFiles): Promise<void> => {
  try {
    const files = glob(matchers, { cwd: rootDir, ignore })
    if (!codependencies) throw '"codependencies" are required'
    const versionMap = await constructVersionMap({
      codependencies,
      exec: execa,
      debug,
      yarnConfig,
      isTesting,
    })
    checkMatches({
      versionMap,
      rootDir,
      files,
      isCLI,
      isSilent: silent,
      isUpdating: update,
      isDebugging: debug,
      isTesting,
    })
  } catch (err) {
    if (debug) {
      logger({
        type: 'error',
        isDebugging: true,
        section: 'checkFiles',
        message: (err as string).toString(),
      })
    }
  }
}

export const script = checkFiles
export const codependence = checkFiles
export const core = codependence
export default core
