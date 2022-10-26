import { promisify } from 'util'
import { exec } from 'child_process'
import gradient from 'gradient-string'
import { sync as glob } from 'fast-glob'
import { readFileSync, writeFileSync } from 'fs-extra'
import {
  CheckFiles,
  CodeDependencies,
  CodeDependenciesItem,
  ConstructVersionMapOptions,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
  LoggerParams,
} from './types'

/**
 * execPromise
 * @description interprets a cmd
 * @param {cmd} string
 * @returns {object}
 */
export const execPromise = promisify(exec)

/**
 * logger
 * @description logs to console messages
 * @param {LoggerParams.type} string
 * @param {LoggerParams.section} string
 * @param {LoggerParams.message} string
 * @param {LoggerParams.err} string
 * @returns {void}
 */
export const logger = ({ type, section = '', message, err = '', isDebugging = false }: LoggerParams): void => {
  const emoji = `🤼‍♀️`
  const gap = ` => `
  const debugMsg = isDebugging ? 'debugging:' : ''
  const sectionMsg = section.length ? `${section}:` : ''
  const firstLine = `codependence:${debugMsg}${sectionMsg}`
  const secondLine = message ? `${emoji}${gap}${message}` : ''
  if (type === 'error') {
    console.error(gradient.passion(firstLine))
    if (secondLine) console.error(secondLine)
    if (err) console.error(err)
  } else if (type === 'debug') {
    console.debug(gradient.passion(firstLine))
    if (secondLine) console.debug(secondLine)
  } else if (type === 'info') {
    console.info(gradient.teen(firstLine))
    if (secondLine) console.info(secondLine)
  } else {
    console.log(gradient.teen(firstLine))
    if (secondLine) console.log(secondLine)
  }
}

/**
 * constructCodependenciesArrayFromCLI
 * @description constructs an array of codependencies from CLI
 * @param {codependencies} array an unparsed array of codependencies
 * @returns {array}
 */
export const constructCodependenciesArrayFromCLI = (codependencies: string[]) =>
  codependencies.map((item) => (!item.includes('{') ? item : JSON.parse(item)))

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
  exec = execPromise,
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
          const isModuleSafeCharacters = /[A-Za-z0-9\-_.]/.test(item)
          if (!isModuleSafeCharacters) throw 'invalid item'
          const cmd = !yarnConfig ? `npm view ${item} version latest` : `yarn npm info ${item} --fields version --json`
          const { stdout = '' } = (await exec(cmd)) as unknown as Record<string, string>

          const version = !yarnConfig
            ? stdout.toString().replace('\n', '')
            : JSON.parse(stdout.toString().replace('\n', ''))?.version
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
    bumpVersion,
    bumpCharacter: specifier,
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
  console.log({ dep, versionMap })
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
 * constructDepsToUpdateList
 * @description returns an array of codependencies including globs
 * @param {codependencies} array
 * @param {opts} object
 * @returns {array} codependencies
 */
export const constructCodependenciesList = (codependencies: CodeDependencies, files: Array<string>, rootDir: string) =>
  codependencies.reduce((acc: CodeDependencies, dep: CodeDependenciesItem): CodeDependencies => {
    // returns all packages which match a <name>* pattern
    if (typeof dep === 'string' && dep.includes('*')) {
      const codependentsGroupName = dep.split('*')[0]
      const codependentsGroup = files.reduce((acc = [], file: string) => {
        const path = `${rootDir}${file}`
        const packageJson = readFileSync(path, 'utf8')
        const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson) as unknown as PackageJSON
        const deps = { ...dependencies, ...devDependencies }
        return [...acc, ...Object.keys(deps).filter((dep) => dep.includes(codependentsGroupName))]
      }, [] as Array<string>)
      return [...acc, ...codependentsGroup]
    }
    return [...acc, dep]
  }, [])

/**
 * writeConsoleMsgs
 * @param {packageName} string
 * @param {depList} array
 * @returns void
 */
export const writeConsoleMsgs = (packageName: string, depList: Array<Record<string, string>>): void => {
  if (!depList.length) return
  Array.from(depList, ({ name: depName, expected, actual }) => {
    logger({
      type: 'log',
      section: packageName,
      message: `${depName} version is incorrect!`,
    })
    console.log(`🤼‍♀️ => Found ${actual} and should be ${expected}`)
  })
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
          { name, expected: version },
        ) => ({
          ...json[depName as keyof T],
          ...newJson,
          [name]: version,
        }),
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
  ignore = ['node_modules/**/*', '**/node_modules/**/*'],
  update = false,
  debug = false,
  silent = false,
  isCLI = false,
  yarnConfig = false,
  isTesting = false,
}: CheckFiles): Promise<void> => {
  try {
    const globOpts = { cwd: rootDir, ignore }
    const files = glob(matchers, globOpts)
    if (!codependencies) throw '"codependencies" are required'
    const codependenciesList = constructCodependenciesList(codependencies, files, rootDir)
    const versionMap = await constructVersionMap({
      codependencies: codependenciesList,
      exec: execPromise,
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
export default codependence
