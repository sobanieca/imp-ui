import { lang, t } from '../../api/i18n.js'
import { createState } from '../../state.js'

export const translatedLabel = (self, key) => {
  const label = createState(`${key}.label`, t(key))
  lang.watch(self, () => label.set(t(key)))
  return label
}
