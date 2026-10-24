import { copyButton } from 'imp/std'
import { flex } from 'imp/std/layout'
import { textField } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Copy button'
export const group = groups.general

const link = 'https://example.com/join/7f3a9c'

export const iconOnly = { scenario: 'Icon only', component: copyButton({ value: link }) }

export const withText = {
  scenario: 'With text',
  component: copyButton({ value: link, variant: 'primary' }, 'Copy link'),
}

export const besideAField = {
  scenario: 'Beside a read-only field',
  component: flex(
    { joined: true },
    textField({ value: link, ariaLabel: 'Shared link', readonly: true }),
    copyButton({ value: link }, 'Copy'),
  ),
}

export const inARow = {
  scenario: 'Small and ghost, for a list row',
  component: copyButton({
    value: link,
    size: 'sm',
    variant: 'ghost',
    label: 'Copy the link of Ada Lovelace',
  }),
}
