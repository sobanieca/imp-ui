import { button, menuButton } from 'imp/std'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Menu button'
export const group = groups.general

const SAVE_ACTIONS = [
  { id: 'draft', label: 'Save as draft' },
  { id: 'template', label: 'Save as template' },
  { id: 'copy', label: 'Save a copy' },
  { id: 'discard', label: 'Discard', disabled: true },
]

const log = (message) => () => console.log(message)

export const more = {
  scenario: 'More actions - the triple-dot trigger',
  component: menuButton({ items: SAVE_ACTIONS }),
}
export const arrow = {
  scenario: 'Arrow trigger',
  component: menuButton({ trigger: 'arrow', items: SAVE_ACTIONS }),
}
export const labelled = {
  scenario: 'With a text label',
  component: menuButton({ trigger: 'arrow', items: SAVE_ACTIONS }, 'Export'),
}
export const splitButton = {
  scenario: 'Split button - joined to the action it extends',
  component: flex(
    { joined: true },
    button({ events: { click: log('save clicked') } }, 'Save'),
    menuButton({ items: SAVE_ACTIONS }),
  ),
}
export const primarySplit = {
  scenario: 'Primary split button',
  component: flex(
    { joined: true },
    button({ variant: 'primary', events: { click: log('save clicked') } }, 'Save changes'),
    menuButton({ variant: 'primary', trigger: 'arrow', items: SAVE_ACTIONS }),
  ),
}
export const disabled = {
  scenario: 'Disabled',
  component: menuButton({ disabled: true, items: SAVE_ACTIONS }),
}
export const small = {
  scenario: 'Small',
  component: menuButton({ size: 'sm', trigger: 'arrow', items: SAVE_ACTIONS }, 'Export'),
}
