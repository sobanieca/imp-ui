import { div, el } from 'imp'

export const card = () => div({ class: 'card' }, { onclick: open }, 'Open')

export const panel = () => el('section', { id: 'a' }, { id: 'b' })
