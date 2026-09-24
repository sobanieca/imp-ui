import { button, icon } from 'imp/std'
import { luCode } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Button'
export const group = groups.general

export const defaultVariant = { scenario: 'Default variant', component: button('Save changes') }
export const primary = {
  scenario: 'Primary',
  component: button({ variant: 'primary' }, 'Save changes'),
}
export const ghost = { scenario: 'Ghost', component: button({ variant: 'ghost' }, 'Cancel') }
export const danger = {
  scenario: 'Danger',
  component: button({ variant: 'danger' }, 'Delete account'),
}
export const link = { scenario: 'Link', component: button({ variant: 'link' }, 'What is this?') }
export const small = {
  scenario: 'Small',
  component: button({ variant: 'primary', size: 'sm' }, 'Small'),
}
export const medium = {
  scenario: 'Medium',
  component: button({ variant: 'primary', size: 'md' }, 'Medium'),
}
export const large = {
  scenario: 'Large',
  component: button({ variant: 'primary', size: 'lg' }, 'Large'),
}
export const disabled = {
  scenario: 'Disabled',
  component: button({ variant: 'primary', disabled: true }, 'Disabled'),
}
export const loading = {
  scenario: 'Loading',
  component: button({ variant: 'primary', loading: true }, 'Saving...'),
}
export const block = {
  scenario: 'Block',
  component: button({ variant: 'primary', block: true }, 'Full width'),
}
export const pressed = { scenario: 'Pressed', component: button({ pressed: true }, 'Bold') }
export const iconToggle = {
  scenario: 'Icon-only toggle',
  component: button(
    { variant: 'ghost', square: true, label: 'Show code', pressed: false },
    icon(luCode),
  ),
}
export const iconAndText = {
  scenario: 'Icon and text',
  component: button({ variant: 'ghost', size: 'sm' }, icon(luCode, { size: 'sm' }), 'Code example'),
}
export const square = {
  scenario: 'Square - an icon-only control',
  component: button({ square: true, label: 'Show code' }, icon(luCode)),
}
export const withClickHandler = {
  scenario: 'With a click handler',
  component: button({ events: { click: () => console.log('button clicked') } }, 'Click me'),
}
