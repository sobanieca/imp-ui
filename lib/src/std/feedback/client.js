import { useHttpClient } from '../../http.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'

export const resolveClient = (name, self, client) => {
  if (typeof client === 'string') {
    try {
      return useHttpClient(self, client)
    } catch (error) {
      impLogger.error(`${name}: ${error.message}`)
      return null
    }
  }
  if (isStateShaped(client?.pending) && isStateShaped(client?.lastError)) return client
  impLogger.warn(
    `${name}: 'client' must be the name of an HTTP client like 'myapp.api', or a client from useHttpClient or createHttpClient`,
  )
  return null
}
