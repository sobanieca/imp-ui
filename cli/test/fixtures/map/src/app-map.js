import { appMap } from 'imp'
import { admin } from './admin/map.js'

export const app = appMap({
  home: { path: '/', description: 'The dashboard' },
  projects: {
    access: 'user',
    $projectId: {
      builds: { $buildId: {} },
      settings: { access: 'admin', group: 'Manage' },
    },
  },
  admin,
  reports: { weekly: {} },
  login: { nav: false },
})
