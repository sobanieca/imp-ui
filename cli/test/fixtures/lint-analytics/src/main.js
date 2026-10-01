import { mount } from 'imp'
import { div } from 'imp/html'
import { onAnalytics, track, zone } from 'imp/analytics'
import { invoice } from './invoice.js'

onAnalytics((record) => console.log(record))

const home = () => zone({ name: 'home' }, div('home'))

const summary = () => zone({ name: 'myapp.summary' }, div('summary'))

const send = () => {
  track('invoiceSent')
  track('myapp.invoice-sent')
}

const dynamic = (name) => zone({ name }, div(name))

mount('#app', div(home(), summary(), invoice(), dynamic('x')))
send()
