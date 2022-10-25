import { promisify } from 'util'
import { exec } from 'child_process'
import { expect, test, vi } from 'vitest'
import { stdoutToJSON } from 'stdouttojson'
import { cosmiconfigSync } from 'cosmiconfig'
import { action } from '../src/program'
import { Options } from '../src/types'

export const execPromise = promisify(exec)

/**
 * @notes
 * all execution tests tests are based on running from root 👌
 * action tests are located after execution tests
 */

vi.mock('cosmiconfig', () => {
  let _cache
  const cosmiconfigSync = () => {
    if (_cache) return _cache
    _cache = {
      load: vi.fn(() => ({
        config: { codependencies: ['lodash', 'fs-extra'] },
      })),
      search: vi.fn(() => ({
        filePath: 'foo',
        config: { codependencies: ['lodash', 'rambda'] },
        isEmpty: false,
      })),
    }
    return _cache
  }
  return { cosmiconfigSync }
})

vi.mock('../scripts', () => ({
  script: vi.fn(),
}))

test('w/ no codependence reference', async () => {
  const { stdout = '{}' } = await execPromise("ts-node ./src/program.ts --rootDir './tests/' --isTestingCLI")
  const result = stdoutToJSON(stdout) as unknown as { updatedOptions: Options }
  expect(result.updatedOptions).toStrictEqual({
    isCLI: 'true',
    rootDir: './tests/',
  })
})

test('w/ only options', async () => {
  const { stdout = '{}' } = await execPromise(
    'ts-node ./src/program.ts --codependencies lodash fs-extra --isTestingCLI',
  )
  const result = stdoutToJSON(stdout) as unknown as { updatedOptions: Options }
  expect(result.updatedOptions).toStrictEqual({
    isCLI: 'true',
    codependencies: ['lodash', 'fs-extra'],
  })
})

test('w/ advanced codependencies put in via cli', async () => {
  const { stdout = '{}' } = await execPromise(
    'ts-node ./src/program.ts --codependencies \'lodash\' \'{ "fs-extra": "10.0.1" }\' --isTestingCLI',
  )
  expect(stdout).toContain('[Object]')
  expect(stdout).toContain('lodash')
})

test('action => load config', async () => {
  vi.clearAllMocks()
  const explorer = cosmiconfigSync('codependence')
  const result = await action({ config: 'foo-bar', isTestingAction: true })
  expect(explorer.search).toHaveBeenCalled()
  expect(explorer.load).toHaveBeenCalled()
  expect(result).toStrictEqual({
    isCLI: true,
    codependencies: ['lodash', 'fs-extra'],
  })
})

test('action => search config', async () => {
  vi.clearAllMocks()
  const explorer = cosmiconfigSync('codependence')
  const result = await action({
    isTestingAction: true,
  })
  expect(explorer.search).toHaveBeenCalled()
  expect(explorer.load).not.toHaveBeenCalled()
  expect(result).toStrictEqual({
    isCLI: true,
    codependencies: ['lodash', 'rambda'],
  })
})
