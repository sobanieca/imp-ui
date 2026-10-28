import { themeSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'ThemeSelect'
export const group = groups.shell

export const systemLightDark = {
  scenario: 'System, light and dark',
  component: themeSelect(),
}

export const named = {
  scenario: 'Named',
  component: themeSelect({ label: 'Appearance' }),
}
