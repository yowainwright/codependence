import { CosmiconfigResult } from 'cosmiconfig/dist/types'

export type CodeDependenciesItem = string | Record<string, string>
export type CodeDependencies = Array<CodeDependenciesItem>

export type Options = {
  isTestingCLI?: boolean
  isTestingAction?: boolean
  isTesting?: boolean
  // TODO enable multiple codependencies
  codependencies?: CodeDependencies
  files?: Array<string>
  config?: string
  rootDir?: string
  ignore?: Array<string>
  update?: boolean
  debug?: boolean
  silent?: boolean
  searchPath?: string
  yarnConfig?: boolean
}

export type ConfigResult = { config: Options } & CosmiconfigResult

export type CheckFiles = {
  codependencies?: CodeDependencies
  files?: Array<string>
  rootDir?: string
  ignore?: Array<string>
  update?: boolean
  debug?: boolean
  silent?: boolean
  isCLI?: boolean
  isTesting?: boolean
  yarnConfig?: boolean
}

export type CheckDependenciesForVersionOptions = {
  isUpdating?: boolean
  isDebugging?: boolean
  isSilent?: boolean
  isTesting?: boolean
}

export type CheckMatches = {
  versionMap: Record<string, string>
  rootDir: string
  files: Array<string>
  isUpdating?: boolean
  isDebugging?: boolean
  isSilent?: boolean
  isCLI?: boolean
  isTesting?: boolean
}

export type CodependenceConfig = {
  codependencies?: CodeDependencies
}

export type PackageJSON = {
  path: string
  codependence?: CodependenceConfig
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  name: string
  version: string
}

export type DepToUpdateItem = {
  name: string
  expected: string
  actual: string
  exact: string
}

export type DepsToUpdate = {
  depList: DepToUpdateItem[]
  devDepList: DepToUpdateItem[]
  peerDepList: DepToUpdateItem[]
}

export type LoggerParams = {
  type: 'info' | 'warn' | 'error' | 'log' | string
  section?: string
  message?: string
  err?: string
  isDebugging?: boolean
  obj?: any
}

export type ConstructVersionMapOptions = {
  codependencies: CodeDependencies
  exec?: any
  debug?: boolean
  yarnConfig?: boolean
  isTesting?: boolean
}
