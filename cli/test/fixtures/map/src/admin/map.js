import { appMap } from 'imp'

export const admin = appMap({ access: 'admin' }, {
  users: {},
  createApiKey: 'Mint a key for a service',
})
