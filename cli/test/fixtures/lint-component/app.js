import { component } from 'imp'
import { div } from 'imp/html'

export const profile = component('profile', {
  build: () => div('profile'),
})

export const settings = component(`Settings-Panel`, {
  build: () => div('settings'),
})

export const glyph = component('font-face', {
  build: () => div('glyph'),
})

export const card = component('my-app-card', {
  build: () => div('card'),
})

export const dynamic = component(globalThis.componentTag, {
  build: () => div('dynamic'),
})
