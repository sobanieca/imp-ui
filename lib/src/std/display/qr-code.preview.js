import { qrCode } from 'imp/std/display'
import { link, text } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { textField } from 'imp/std/inputs'
import { initState } from 'imp/state'
import { component } from 'imp'
import { groups } from '../preview-groups.js'

export const name = 'QR code'
export const group = groups.display

export const withLink = {
  scenario: 'A link, with the address as text',
  component: stack(
    { gap: 2, horizontalAlign: 'start' },
    qrCode({ value: 'https://imp.example.com/invite/42', label: 'QR code of the invite link' }),
    link({ href: 'https://imp.example.com/invite/42' }, 'imp.example.com/invite/42'),
  ),
}

export const sizes = {
  scenario: 'Sizes',
  component: flex(
    { gap: 4, wrap: true, verticalAlign: 'bottom' },
    qrCode({ value: 'https://imp.example.com', size: 'sm' }),
    qrCode({ value: 'https://imp.example.com' }),
    qrCode({ value: 'https://imp.example.com', size: 'lg' }),
  ),
}

export const errorCorrection = {
  scenario: 'Error correction levels',
  component: flex(
    { gap: 4, wrap: true, verticalAlign: 'bottom' },
    ...['L', 'M', 'Q', 'H'].map((level) =>
      stack(
        { gap: 1, horizontalAlign: 'center' },
        qrCode({ value: 'https://imp.example.com', errorCorrection: level, size: 'sm' }),
        text({ tone: 'secondary' }, level),
      )
    ),
  ),
}

const liveDemo = component('qr-preview-live', {
  setup: (self) => {
    const value = initState(self, 'preview.qrValue', 'Hello from imp')
    return stack(
      { gap: 3, horizontalAlign: 'start' },
      textField({ label: 'Text to encode', value }),
      qrCode({ value, label: 'QR code of the text above' }),
    )
  },
})

export const live = { scenario: 'Follows a state', component: liveDemo() }
