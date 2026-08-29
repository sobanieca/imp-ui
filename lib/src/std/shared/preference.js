import { impLogger } from '../../logger.js'

export const readPreference = (key) => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch (failure) {
    impLogger.debug(`could not read the '${key}' preference from localStorage`, failure)
    return null
  }
}

export const writePreference = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch (failure) {
    impLogger.debug(`could not store the '${key}' preference in localStorage`, failure)
  }
}
