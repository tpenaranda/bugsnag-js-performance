import { type Logger } from './config'
import { type PersistedProbability } from './persistence'

export const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const isString = (value: unknown): value is string =>
  typeof value === 'string'

export const isStringWithLength = (value: unknown): value is string =>
  isString(value) && value.length > 0

export const isLogger = (value: unknown): value is Logger =>
  isObject(value) &&
    typeof value.debug === 'function' &&
    typeof value.info === 'function' &&
    typeof value.warn === 'function' &&
    typeof value.error === 'function'

export const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isStringWithLength)

export const isStringOrRegExpArray = (value: unknown): value is Array<string | RegExp> => Array.isArray(value) && value.every(item => isStringWithLength(item) || item instanceof RegExp)

export function isPersistedProbabilty (value: unknown): value is PersistedProbability {
  return isObject(value) &&
    typeof value.value === 'number' &&
    typeof value.time === 'number'
}
