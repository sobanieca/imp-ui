import { button, buttonGroup, icon } from 'imp/std'
import { textField } from 'imp/std/inputs'
import {
  luBold,
  luChevronLeft,
  luChevronRight,
  luItalic,
  luMinus,
  luPlus,
  luUnderline,
} from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Button group'
export const group = groups.general

const SAVE_ACTIONS = [
  { id: 'draft', label: 'Save as draft' },
  { id: 'template', label: 'Save as template' },
  { id: 'copy', label: 'Save a copy' },
  { id: 'discard', label: 'Discard', disabled: true },
]

const log = (message) => () => console.log(message)

export const splitButton = {
  scenario: 'Split button - a triple-dot menu beside the action',
  component: buttonGroup(
    { items: SAVE_ACTIONS },
    button({ events: { click: log('save clicked') } }, 'Save'),
  ),
}
export const primarySplit = {
  scenario: 'Primary split button',
  component: buttonGroup(
    { variant: 'primary', items: SAVE_ACTIONS },
    button({ variant: 'primary', events: { click: log('save clicked') } }, 'Save changes'),
  ),
}
export const arrowTrigger = {
  scenario: 'Arrow trigger',
  component: buttonGroup(
    { trigger: 'arrow', items: SAVE_ACTIONS },
    button({ events: { click: log('save clicked') } }, 'Save'),
  ),
}
export const menuOnly = {
  scenario: 'Menu only - no children',
  component: buttonGroup({ trigger: 'arrow', items: SAVE_ACTIONS }),
}
export const disabledMenu = {
  scenario: 'Disabled menu beside a live action',
  component: buttonGroup(
    { disabled: true, items: SAVE_ACTIONS },
    button({ events: { click: log('save clicked') } }, 'Save'),
  ),
}
export const small = {
  scenario: 'Small',
  component: buttonGroup(
    { size: 'sm', trigger: 'arrow', items: SAVE_ACTIONS },
    button({ size: 'sm', events: { click: log('save clicked') } }, 'Save'),
  ),
}
export const zoomControl = {
  scenario: 'A zoom control with a read-only segment',
  component: buttonGroup(
    { label: 'Zoom' },
    button({ label: 'Zoom out', square: true, events: { click: log('zoom out') } }, icon(luMinus)),
    '100%',
    button({ label: 'Zoom in', square: true, events: { click: log('zoom in') } }, icon(luPlus)),
  ),
}
export const pager = {
  scenario: 'A pager with a text field',
  component: buttonGroup(
    { label: 'Go to page' },
    button({ label: 'Previous page', square: true }, icon(luChevronLeft)),
    textField({ value: '12', ariaLabel: 'Page number' }),
    button({ label: 'Next page', square: true }, icon(luChevronRight)),
  ),
}
export const textStyles = {
  scenario: 'A bar of toggles',
  component: buttonGroup(
    { label: 'Text style' },
    button({ variant: 'ghost', square: true, label: 'Bold', pressed: true }, icon(luBold)),
    button({ variant: 'ghost', square: true, label: 'Italic', pressed: false }, icon(luItalic)),
    button(
      { variant: 'ghost', square: true, label: 'Underline', pressed: false },
      icon(luUnderline),
    ),
  ),
}
export const mixedVariants = {
  scenario: 'Mixed variants in one row',
  component: buttonGroup(
    { label: 'Review' },
    button({ variant: 'primary', events: { click: log('approve') } }, 'Approve'),
    button({ events: { click: log('comment') } }, 'Comment'),
    button({ variant: 'danger', events: { click: log('reject') } }, 'Reject'),
  ),
}
