import { expect, test, vi } from 'vitest'
import * as scripts from '../src/scripts/core'
const {
  constructVersionMap,
  constructVersionTypes,
  constructDepsToUpdateList,
  constructDeps,
  constructJson,
  checkDependenciesForVersion,
  checkMatches,
  checkFiles,
} = scripts

test('constructVersionMap => pass', async () => {
  const exec = vi.fn(() => ({
    stdout: '4.0.0',
    stderr: '',
  })) as any
  const validate = vi.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }))
  const result = await constructVersionMap({
    codependencies: ['lodash'],
    exec,
    validate,
  })
  expect(result).toEqual({ lodash: '4.0.0' })
})

test('constructVersionMap => with object in codependencies', async () => {
  const exec = vi.fn(() => ({
    stdout: '4.0.0',
    stderr: '',
  })) as any
  const validate = vi.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }))
  const result = await constructVersionMap({
    codependencies: [{ lodash: '4.0.0' }],
    exec,
    validate,
  })
  expect(result).toEqual({ lodash: '4.0.0' })
})

test('constructVersionMap => with yarnConfig', async () => {
  const exec = vi.fn(() => ({
    stdout: '{"version":"4.0.0"}',
    stderr: '',
  })) as any
  const validate = vi.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }))
  const result = await constructVersionMap({
    codependencies: ['lodash'],
    exec,
    yarnConfig: true,
    validate,
  })
  expect(result).toEqual({ lodash: '4.0.0' })
})

test('constructVersionMap => fail', async () => {
  const exec = vi.fn(() => ({
    stdout: '',
    stderr: '',
  })) as any
  const validate = vi.fn(() => ({
    validForNewPackages: false,
    validForOldPackages: true,
    errors: ['foo-bop', 'foo-beep'],
  }))
  const result = await constructVersionMap({
    codependencies: ['lodash'],
    exec,
    isTesting: true,
    validate,
  })
  expect(result).toEqual({})
})

test('constructVersionMap => with invalid item type', async () => {
  const exec = vi.fn(() => ({
    stdout: '4.0.0',
    stderr: '',
  })) as any
  const validate = vi.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }))
  const result = await constructVersionMap({
    codependencies: ['lodash with space'],
    exec,
    isTesting: true,
    validate,
  })
  expect(result).toEqual({})
})

test('constructVersionTypes => with ^', () => {
  const result = constructVersionTypes('^1.2.3')
  expect(result).toEqual({ bumpCharacter: '^', bumpVersion: '^1.2.3', exactVersion: '1.2.3' })
})

test('constructVersionTypes with no specifier', () => {
  const { bumpVersion, exactVersion } = constructVersionTypes('1.2.3')
  expect(bumpVersion).toEqual(exactVersion)
})

test('constructDepsToUpdateList => returns dep to update list with exact characters', () => {
  const result = constructDepsToUpdateList({ foo: '1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '2.0.0',
      actual: '1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => returns dep to update list with special characters', () => {
  const result = constructDepsToUpdateList({ foo: '~1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '~2.0.0',
      actual: '~1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => preserves caret prefix', () => {
  const result = constructDepsToUpdateList({ foo: '^1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '^2.0.0',
      actual: '^1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => handles multiple caret prefixes correctly', () => {
  const result = constructDepsToUpdateList({ foo: '^^1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '^2.0.0', // Should only have one ^ character
      actual: '^^1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => handles multiple tilde prefixes correctly', () => {
  const result = constructDepsToUpdateList({ foo: '~~~1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '~2.0.0', // Should only have one ~ character
      actual: '~~~1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => handles mixed special characters correctly', () => {
  const result = constructDepsToUpdateList({ foo: '^~^1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '^2.0.0', // Should use the first character (^)
      actual: '^~^1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => preserves tilde prefix', () => {
  const result = constructDepsToUpdateList({ foo: '~1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([
    {
      name: 'foo',
      exact: '2.0.0',
      expected: '~2.0.0',
      actual: '~1.0.0',
    },
  ])
})

test('constructDepsToUpdateList => with empty dependency object', () => {
  const result = constructDepsToUpdateList({}, { foo: '2.0.0' })
  expect(result).toEqual([])
})

test('constructDepsToUpdateList => with dependency not in versionMap', () => {
  const result = constructDepsToUpdateList({ bar: '1.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([])
})

test('constructDepsToUpdateList => with same version in versionMap', () => {
  const result = constructDepsToUpdateList({ foo: '2.0.0' }, { foo: '2.0.0' })
  expect(result).toEqual([])
})

test('constructVersionTypes => normalizes multiple special characters to a single one', () => {
  const result = constructVersionTypes('^^1.2.3')
  // Should only extract the first ^ as the bumpCharacter and remove all special characters from exactVersion
  expect(result).toEqual({ bumpCharacter: '^', bumpVersion: '^^1.2.3', exactVersion: '1.2.3' })
})

test('constructVersionTypes => normalizes multiple tilde characters to a single one', () => {
  const result = constructVersionTypes('~~~1.2.3')
  expect(result).toEqual({ bumpCharacter: '~', bumpVersion: '~~~1.2.3', exactVersion: '1.2.3' })
})

test('constructVersionTypes => handles mixed special characters correctly', () => {
  const result = constructVersionTypes('^~^1.2.3')
  // Should use the first character as the bumpCharacter
  expect(result).toEqual({ bumpCharacter: '^', bumpVersion: '^~^1.2.3', exactVersion: '1.2.3' })
})

test('constructVersionTypes => handles empty string', () => {
  const result = constructVersionTypes('')
  expect(result).toEqual({ bumpCharacter: '', bumpVersion: '', exactVersion: '' })
})

test('constructVersionTypes => handles version with only special characters', () => {
  const result = constructVersionTypes('^^^')
  expect(result).toEqual({ bumpCharacter: '^', bumpVersion: '^^^', exactVersion: '' })
})

test('constructDeps => with update', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    dependencies: { bar: '1.0.0' },
    path: './test',
  }
  const depName = 'bar'
  const depList = [{ name: 'bar', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' }]
  const result = constructDeps(json, depName, depList)
  expect(result).toEqual({ bar: '2.0.0' })
})

test('constructDeps => with no deplist', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    dependencies: { bar: '1.0.0' },
    path: './test',
  }
  const depName = 'bar'
  const depList = []
  const result = constructDeps(json, depName, depList)
  expect(result).not.toBeDefined()
})

test('constructDeps => with more deps', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', biz: '1.0.0' },
    path: './test',
  }
  const depName = 'bar'
  const depList = [
    { name: 'bar', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    { name: 'biz', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
  ]
  const result = constructDeps(json, depName, depList)
  expect(result).toEqual({ bar: '2.0.0', biz: '2.0.0' })
})

test('constructJson => with updates', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', biz: '1.0.0' },
    path: './test',
  }
  const depsToUpdate = {
    depList: [
      { name: 'bar', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'biz', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
    peerDepList: [],
    devDepList: [],
  }
  const result = constructJson(json, depsToUpdate)
  expect(result).toStrictEqual({
    name: 'foo',
    path: './test',
    version: '1.0.0',
    dependencies: {
      bar: '2.0.0',
      biz: '2.0.0',
    },
  })
})

test('constructJson => with devDependencies', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    devDependencies: { bar: '1.0.0', biz: '1.0.0' },
    path: './test',
  }
  const depsToUpdate = {
    depList: [],
    peerDepList: [],
    devDepList: [
      { name: 'bar', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'biz', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
  }
  const result = constructJson(json, depsToUpdate)
  expect(result).toStrictEqual({
    name: 'foo',
    path: './test',
    version: '1.0.0',
    devDependencies: {
      bar: '2.0.0',
      biz: '2.0.0',
    },
  })
})

test('constructJson => with peerDependencies', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    peerDependencies: { bar: '1.0.0', biz: '1.0.0' },
    path: './test',
  }
  const depsToUpdate = {
    depList: [],
    devDepList: [],
    peerDepList: [
      { name: 'bar', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'biz', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
  }
  const result = constructJson(json, depsToUpdate)
  expect(result).toStrictEqual({
    name: 'foo',
    path: './test',
    version: '1.0.0',
    peerDependencies: {
      bar: '2.0.0',
      biz: '2.0.0',
    },
  })
})

test('constructJson => with all dependency types', () => {
  const json = {
    name: 'foo',
    version: '1.0.0',
    dependencies: { dep1: '1.0.0', dep2: '1.0.0' },
    devDependencies: { dev1: '1.0.0', dev2: '1.0.0' },
    peerDependencies: { peer1: '1.0.0', peer2: '1.0.0' },
    path: './test',
  }
  const depsToUpdate = {
    depList: [
      { name: 'dep1', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'dep2', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
    devDepList: [
      { name: 'dev1', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'dev2', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
    peerDepList: [
      { name: 'peer1', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
      { name: 'peer2', expected: '2.0.0', actual: '1.0.0', exact: '2.0.0' },
    ],
  }
  const result = constructJson(json, depsToUpdate)
  expect(result).toStrictEqual({
    name: 'foo',
    path: './test',
    version: '1.0.0',
    dependencies: {
      dep1: '2.0.0',
      dep2: '2.0.0',
    },
    devDependencies: {
      dev1: '2.0.0',
      dev2: '2.0.0',
    },
    peerDependencies: {
      peer1: '2.0.0',
      peer2: '2.0.0',
    },
  })
})

test('checkDependenciesForVersion => has updates', () => {
  const versionMap = {
    foo: '2.0.0',
    bar: '2.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', foo: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(true)
})

test('checkDependenciesForVersion => has updates + special characters', () => {
  const versionMap = {
    foo: '2.0.0',
    bar: '2.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', foo: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(true)
})

test('checkDependenciesForVersion => no updates', () => {
  const versionMap = {
    foo: '1.0.0',
    bar: '1.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', foo: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(false)
})

test('checkDependenciesForVersion => no updates', () => {
  vi.clearAllMocks()
  const versionMap = {
    foo: '1.0.0',
    bar: '1.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', foo: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(false)
})

test('checkDependenciesForVersion => with isUpdating=true', () => {
  vi.clearAllMocks()
  const versionMap = {
    foo: '2.0.0',
    bar: '2.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    dependencies: { bar: '1.0.0', foo: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
    isUpdating: true,
  })
  expect(result).toEqual(true)
})

test('checkDependenciesForVersion => with no dependencies', () => {
  vi.clearAllMocks()
  const versionMap = {
    foo: '2.0.0',
    bar: '2.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(false)
})

test('checkDependenciesForVersion => with devDependencies and peerDependencies', () => {
  vi.clearAllMocks()
  const versionMap = {
    foo: '2.0.0',
    bar: '2.0.0',
  }
  const json = {
    name: 'biz',
    version: '1.0.0',
    devDependencies: { foo: '1.0.0' },
    peerDependencies: { bar: '1.0.0' },
    path: './test',
  }
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  })
  expect(result).toEqual(true)
})

test('checkMatches => no updates', () => {
  vi.clearAllMocks()
  const logCheckMatchesNoUpdates = vi.spyOn(console, 'log')
  const versionMap = {
    foo: '1.0.0',
    bar: '1.0.0',
  }
  const rootDir = './test/'
  const isTesting = true
  const files = ['test-pass-package.json']
  checkMatches({ versionMap, files, isTesting, rootDir })
  expect(logCheckMatchesNoUpdates).toBeCalled()
})

test('checkMatches => with error', () => {
  vi.clearAllMocks()
  const logCheckMatchesWithError = vi.spyOn(console, 'error')
  const versionMap = {
    lodash: '4.18.0',
    'fs-extra': '5.0.0',
  }
  const rootDir = './test/'
  const isTesting = true
  const files = ['test-fail-package.json']
  checkMatches({ versionMap, files, isTesting, rootDir })
  expect(logCheckMatchesWithError).toBeCalled()
})

test('checkFiles => with no updates', async () => {
  vi.clearAllMocks()
  const logCheckFilesNoUpdates = vi.spyOn(console, 'log')
  const codependencies = ['lodash', 'fs-extra']
  const rootDir = './test/'
  const files = ['test-pass-package.json']
  await checkFiles({ codependencies, rootDir, files })
  expect(logCheckFilesNoUpdates).toBeCalled()
})

test('checkFiles => with updates', async () => {
  vi.clearAllMocks()
  const logCheckFilesWithUpdates = vi.spyOn(console, 'error')
  const codependencies = ['lodash', 'fs-extra']
  const rootDir = './test/'
  const files = ['test-fail-package.json']
  await checkFiles({ codependencies, rootDir, files })
  expect(logCheckFilesWithUpdates).toBeCalled()
})

test('checkFiles => with no codeps', async () => {
  vi.clearAllMocks()
  const logCheckFilesWithNoCoDeps = vi.spyOn(console, 'error')
  const codependencies = null
  const rootDir = './test/'
  const files = ['test-fail-package.json']
  await checkFiles({ codependencies, rootDir, files, debug: true } as any)
  expect(logCheckFilesWithNoCoDeps).toBeCalled()
})
