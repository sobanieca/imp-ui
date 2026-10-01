import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', nav: false },
  signIn: { nav: false, description: 'The sign-in form, shown without the chrome' },
  todos: {
    description: 'The todo list, with a form to add one',
    access: 'user',
    $todoId: 'One todo, with its notes and an edit dialog',
  },
  stats: { description: 'How much is done, per priority', access: 'user' },
  about: { description: 'What this example shows, and a bug report button', access: 'user' },
})
