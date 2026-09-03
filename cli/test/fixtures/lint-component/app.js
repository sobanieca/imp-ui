import { component } from 'imp'
import { div } from 'imp/html'

export const profile = component('profile', {
  setup: () => div('profile'),
})

export const settings = component(`Settings-Panel`, {
  setup: () => div('settings'),
})

export const glyph = component('font-face', {
  setup: () => div('glyph'),
})

export const card = component('my-app-card', {
  setup: () => div('card'),
})

export const dynamic = component(globalThis.componentTag, {
  setup: () => div('dynamic'),
})
