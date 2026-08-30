import { init, mount } from 'imp'
import { app } from './app.js'

await init({ theme: 'imp-light' })

mount('#app', app())
