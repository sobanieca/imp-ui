import { div, initState, useState } from 'imp'

export const app = () => {
  const user = initState('user', { name: 'Ada' })
  const theme = useState('theme')
  const count = initState(`count`, 0)
  const settings = initState('myapp.settings.', {})
  const good = initState('myapp.cart', [])
  const dynamic = useState(globalThis.stateName)
  return div(user.text(), theme.text(), count.text(), settings.text(), good.text(), dynamic.text())
}
