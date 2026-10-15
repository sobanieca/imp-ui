import { component } from 'imp'
import { luFile, luFileText, luFolder } from 'imp/icons'
import { text } from 'imp/std'
import { tree } from 'imp/std/data'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Tree'
export const group = groups.data

const fileTree = () => [
  {
    id: 'src',
    label: 'src',
    icon: luFolder,
    children: [
      {
        id: 'src/components',
        label: 'components',
        icon: luFolder,
        children: [
          { id: 'src/components/invoice-table.js', label: 'invoice-table.js', icon: luFile },
          { id: 'src/components/team-list.js', label: 'team-list.js', icon: luFile },
        ],
      },
      { id: 'src/main.js', label: 'main.js', icon: luFile },
      { id: 'src/routes.js', label: 'routes.js', icon: luFile },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    icon: luFolder,
    children: [
      { id: 'docs/guide.md', label: 'guide.md', icon: luFileText },
      { id: 'docs/changes.md', label: 'changes.md', icon: luFileText },
    ],
  },
  { id: 'imp.json', label: 'imp.json', icon: luFile },
  { id: 'readme', label: 'README.md', icon: luFileText },
]

export const files = {
  scenario: 'File tree',
  component: tree({ label: 'Project files', items: fileTree(), expanded: ['src'] }),
}

export const allExpanded = {
  scenario: 'All expanded',
  component: tree({ label: 'Project files', items: fileTree(), expanded: 'all' }),
}

export const controlled = {
  scenario: 'Controlled selection',
  component: component('tree-selection-demo', {
    setup: (self) => {
      const current = initState(self, 'demo.tree.current', 'src/main.js')
      const open = initState(self, 'demo.tree.open', ['src'])
      return stack(
        { gap: 3 },
        tree({ label: 'Project files', items: fileTree(), selected: current, expanded: open }),
        text(
          { tone: 'secondary', size: 'sm' },
          current.text((id) => `Selected: ${id}`),
        ),
        text(
          { tone: 'secondary', size: 'sm' },
          open.text((ids) => `Expanded: ${ids.join(', ')}`),
        ),
      )
    },
  })(),
}

export const plain = {
  scenario: 'No icons',
  component: tree({
    label: 'Departments',
    expanded: 'all',
    items: [
      {
        id: 'product',
        label: 'Product',
        children: [
          { id: 'design', label: 'Design' },
          { id: 'research', label: 'Research' },
        ],
      },
      {
        id: 'engineering',
        label: 'Engineering',
        children: [
          { id: 'web', label: 'Web' },
          { id: 'platform', label: 'Platform' },
        ],
      },
    ],
  }),
}
