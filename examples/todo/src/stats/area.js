import { area } from 'imp/router'
import { app } from '../app-map.js'
import { statsScreen } from './stats-screen.js'

export default area({
  screens: { [app.stats]: () => statsScreen() },
  translations: { en: () => import('./locales/en.js'), pl: () => import('./locales/pl.js') },
})
