import { appMap } from 'imp'

export const admin = appMap({ description: 'The back office' }, {
  users: {},
  createApiKey: 'Mint a key for a service',
})
