import { expect, test, vi } from 'vitest'
import * as utils from '../src/scripts/utils'
const { writeConsoleMsgs, logger } = utils

test('writeConsoleMsgs => should call log', () => {
  const writeLog = vi.spyOn(console, 'log')
  writeConsoleMsgs('foo', [{ name: 'foo', expected: '1.0.0', actual: '2.0.0' }])
  expect(writeLog).toHaveBeenCalledTimes(3)
})

test('writeConsoleMsgs => with empty depList', () => {
  const writeLog = vi.spyOn(console, 'log')
  writeConsoleMsgs('foo', [])
  expect(writeLog).not.toHaveBeenCalled()
})

test('logger => with error type', () => {
  const consoleError = vi.spyOn(console, 'error')
  logger({ type: 'error', message: 'test error' })
  expect(consoleError).toHaveBeenCalled()
})

test('logger => with debug type', () => {
  const consoleDebug = vi.spyOn(console, 'debug')
  logger({ type: 'debug', message: 'test debug' })
  expect(consoleDebug).toHaveBeenCalled()
})

test('logger => with info type', () => {
  const consoleInfo = vi.spyOn(console, 'info')
  logger({ type: 'info', message: 'test info' })
  expect(consoleInfo).toHaveBeenCalled()
})

test('logger => with log type', () => {
  const consoleLog = vi.spyOn(console, 'log')
  logger({ type: 'log', message: 'test log' })
  expect(consoleLog).toHaveBeenCalled()
})

test('logger => with error message', () => {
  const consoleError = vi.spyOn(console, 'error')
  logger({ type: 'error', message: 'test error', err: 'error details' })
  expect(consoleError).toHaveBeenCalledTimes(3) // First line, second line, and error details
})

test('logger => with isDebugging', () => {
  const consoleLog = vi.spyOn(console, 'log')
  logger({ type: 'log', message: 'test log', isDebugging: true })
  expect(consoleLog).toHaveBeenCalled()
})
