import { button } from 'imp/std'
import { expect, test } from 'imp/test'

test('a std component defines its custom element on first use, not on import', () => {
  expect(customElements.get('imp-button')).toEqual(undefined)
  button('Save')
  expect(customElements.get('imp-button')).toBeTruthy()
})
