import { themeSelect } from 'imp/std/shell'

export const name = 'ThemeSelect'
export const category = 'Shell'
export const description =
  "Run 'imp skill std/themeSelect' to learn what themeSelect can do before using it."

export const systemLightDark = themeSelect({ remember: false })

export const lightAndDarkOnly = themeSelect({
  remember: false,
  themes: ['imp-light', 'imp-dark'],
})

export const withTheHighContrastThemes = themeSelect({
  remember: false,
  themes: [
    'imp-light',
    'imp-dark',
    { value: 'imp-high-contrast-light', label: 'High contrast light' },
    { value: 'imp-high-contrast-dark', label: 'High contrast dark' },
  ],
})

export const named = themeSelect({ remember: false, label: 'Appearance' })
