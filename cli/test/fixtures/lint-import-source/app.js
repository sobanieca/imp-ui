import { component, div, useState } from 'imp'
import { mount, navigate } from 'imp/router'
import { applyTheme } from 'imp/theme'
import { button } from 'imp/std'

export const panel = component('demo-panel', {
  onMount: () => {
    const open = useState('demo.open')
    applyTheme('imp-light')
    return div(button({ events: { click: () => navigate('/next') } }, open.text()))
  },
})

mount('#app', panel)
