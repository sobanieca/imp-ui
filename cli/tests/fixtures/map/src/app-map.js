import { appMap } from 'imp'
import { admin } from './admin/map.js'

export const app = appMap({
  home: 'The dashboard',
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
