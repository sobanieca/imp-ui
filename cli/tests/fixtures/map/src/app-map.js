import { appMap } from 'imp'
import { admin } from './admin/map.js'

export const app = appMap({
  projects: {
    description: 'Every project of the team',
    $projectId: {
      builds: { $buildId: {} },
      settings: {},
    },
  },
  admin,
  reports: { weekly: {} },
  login: {},
})
