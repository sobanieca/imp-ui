import { div, el } from 'imp/html'
import { button } from 'imp/std'
import { emptyState } from 'imp/std/display'

export const card = () => div({ class: 'card' }, { onclick: open }, 'Open')

export const panel = () => el('section', { id: 'a' }, { id: 'b' })

export const action = () => button({ variant: 'primary' }, 'Save', { size: 'lg' })

export const blank = () => emptyState({ variant: 'empty' }, { title: 'None' })
