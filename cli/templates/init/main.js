import { init, mount } from 'imp'
import { root } from './app.js'
import theme from './theme.js'

await init({ theme })

mount('#app', root())
