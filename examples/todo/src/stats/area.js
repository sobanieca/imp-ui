import { area } from 'imp/router'
import { statsShell } from './shell.js'
import { summaryScreen } from './summary.js'
import { priorityScreen } from './priority.js'

export default area({
  root: () => statsShell(),
  routes: {
    '/': () => summaryScreen(),
    '/priority/:name': ({ params }) => priorityScreen(params.name),
  },
  translations: {
    en: () => import('./locales/en.js'),
    pl: () => import('./locales/pl.js'),
  },
})
