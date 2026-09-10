import { themeSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'ThemeSelect'
export const group = groups.shell

export const systemLightDark = {
  scenario: 'System, light and dark',
  component: themeSelect({ remember: false }),
}

export const lightAndDarkOnly = {
  scenario: 'Light and dark only',
  component: themeSelect({
    remember: false,
    themes: ['imp-light', 'imp-dark'],
  }),
}

export const withTheHighContrastThemes = {
  scenario: 'With the high-contrast themes',
  component: themeSelect({
    remember: false,
    themes: [
      'imp-light',
      'imp-dark',
      { value: 'imp-high-contrast-light', label: 'High contrast light' },
      { value: 'imp-high-contrast-dark', label: 'High contrast dark' },
    ],
  }),
}

export const named = {
  scenario: 'Named',
  component: themeSelect({ remember: false, label: 'Appearance' }),
}
