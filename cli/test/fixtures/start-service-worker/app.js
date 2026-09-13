import { mount } from 'imp'
import { div } from 'imp/html'

navigator.serviceWorker.register('/sw.js')

mount('#app', () => div('an app with its own service worker'))
