import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', nav: false },
  todos: {
    description: 'The todo list, with a form to add one',
    $todoId: 'One todo, with its notes and an edit dialog',
  },
  stats: { description: 'How much is done, per priority', access: 'user' },
  about: 'What this example shows, and a bug report button',
})
