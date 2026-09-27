import { impLogger } from './logger.js'

export const allowedBy = async (checks, label) => {
  for (const check of checks) {
    try {
      if ((await check()) === false) return false
    } catch (error) {
      impLogger.error(`${label} failed - imp keeps what is on the screen`, error)
      return false
    }
  }
  return true
}
