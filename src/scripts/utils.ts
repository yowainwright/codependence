import gradient from 'gradient-string'

import { LoggerParams } from '../types'

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
