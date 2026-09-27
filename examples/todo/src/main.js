import { init, mount } from 'imp'
import { root } from './app.js'
import { auroraLight } from './theme.js'

await init({
  theme: auroraLight,
  translations: { en: () => import('../locales/en.js'), pl: () => import('../locales/pl.js') },
})

mount('#app', root())
