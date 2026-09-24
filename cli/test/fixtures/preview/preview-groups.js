import { luBox, luLayoutGrid } from 'imp/icons'

export const groups = {
  components: { name: 'components', icon: luBox },
  widgets: {
    name: 'Widgets',
    icon: luLayoutGrid,
    priority: 1,
    description: 'Small **stateful** widgets. Each one keeps its count in a state.',
  },
}
