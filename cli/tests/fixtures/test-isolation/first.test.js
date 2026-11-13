import { expect, test } from 'imp/test'

test('the page starts with no state of another file', () => {
  expect(localStorage.getItem('visited')).toEqual(null)
  expect(document.cookie).toEqual('')
  expect(history.length).toEqual(1)
  localStorage.setItem('visited', 'yes')
  document.cookie = 'visited=yes'
})
