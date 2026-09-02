import { button } from 'imp/std'

export const name = 'Button'
export const group = 'General'
export const description = "Run 'imp skill std/button' to learn what button can do before using it."

export const defaultVariant = button('Save changes')
export const primary = button({ variant: 'primary' }, 'Save changes')
export const ghost = button({ variant: 'ghost' }, 'Cancel')
export const danger = button({ variant: 'danger' }, 'Delete account')
export const link = button({ variant: 'link' }, 'What is this?')
export const small = button({ variant: 'primary', size: 'sm' }, 'Small')
export const medium = button({ variant: 'primary', size: 'md' }, 'Medium')
export const large = button({ variant: 'primary', size: 'lg' }, 'Large')
export const disabled = button({ variant: 'primary', disabled: true }, 'Disabled')
export const loading = button({ variant: 'primary', loading: true }, 'Saving...')
export const block = button({ variant: 'primary', block: true }, 'Full width')
export const withClickHandler = button(
  { events: { click: () => console.log('button clicked') } },
  'Click me',
)
export const withMenu = button({
  items: [
    { id: 'duplicate', label: 'Duplicate' },
    { id: 'rename', label: 'Rename' },
    { id: 'archive', label: 'Archive' },
    { id: 'delete', label: 'Delete', disabled: true },
  ],
  events: { click: () => console.log('save clicked') },
}, 'Save')
export const withHoverMenu = button({
  menuTrigger: 'hover',
  items: [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'high-contrast', label: 'High contrast' },
  ],
}, 'Theme')
export const primaryWithMenu = button({
  variant: 'primary',
  items: [{ id: 'draft', label: 'Save as draft' }, { id: 'template', label: 'Save as template' }],
}, 'Save changes')
