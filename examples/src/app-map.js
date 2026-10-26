import { appMap } from 'imp'

export const app = appMap({
  signIn: 'The sign-in form, shown without the chrome',
  todos: {
    description: 'The todo list, with a form to add one',
    $todoId: 'One todo, with its notes and an edit dialog',
  },
  stats: 'How much is done, per priority',
  about: 'What this example shows, and a bug report button',
})
