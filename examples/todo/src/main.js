import { init, mount } from 'imp'
import { app } from './app.js'
import midnight from './theme/midnight.js'

const savedTheme = localStorage.getItem('todo.theme')
const savedLang = localStorage.getItem('todo.lang')

await init({
  theme: savedTheme === midnight.name ? midnight : 'imp-light',
  lang: savedLang ?? undefined,
  translations: {
    en: () => import('../locales/en.js'),
    pl: () => import('../locales/pl.js'),
  },
})

mount('#app', app())
