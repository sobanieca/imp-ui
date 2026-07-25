import { component } from 'imp'
import { div } from 'imp/html'

export const profile = component('profile', {
  onMount: () => div('profile'),
})

export const settings = component(`Settings-Panel`, {
  onMount: () => div('settings'),
})

export const glyph = component('font-face', {
  onMount: () => div('glyph'),
})

export const card = component('my-app-card', {
  onMount: () => div('card'),
})

export const dynamic = component(globalThis.componentTag, {
  onMount: () => div('dynamic'),
})
