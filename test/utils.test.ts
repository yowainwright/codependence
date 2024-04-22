import { expect, test, vi } from 'vitest'
import * as utils from '../src/scripts/utils'
const { writeConsoleMsgs } = utils

test('writeConsoleMsgs => should call log', () => {
  const writeLog = vi.spyOn(console, 'log')
  writeConsoleMsgs('foo', [{ name: 'foo', expected: '1.0.0', actual: '2.0.0' }])
  expect(writeLog).toHaveBeenCalledTimes(3)
})
