import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', nav: false },
  tasks: {
    description: 'The demo list, filtered three ways.',
    all: { label: 'All tasks', description: 'Every task in the demo list.' },
    active: 'What is still waiting to be done.',
    done: 'What is already finished.',
    $taskId: 'One task on its own.',
  },
  settings: 'Nothing here is stored. The screen resets or empties the demo list.',
})
