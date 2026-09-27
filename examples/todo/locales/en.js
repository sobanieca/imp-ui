export default {
  app: {
    name: 'Todo',
    tagline: 'An imp example',
    signOut: 'Sign out',
  },
  account: {
    open: 'Account and settings',
    title: 'Account',
    language: 'Language',
    theme: 'Theme',
  },
  signIn: {
    title: 'Sign in',
    intro: 'Any name and email work. The mock backend accepts everybody.',
    name: 'Name',
    email: 'Email',
    submit: 'Sign in',
  },
  todos: {
    title: 'Todos',
    add: 'Add',
    newTitle: 'What needs to be done?',
    priority: 'Priority',
    due: 'Due date',
    filter: 'Show',
    all: 'All',
    active: 'Open',
    completed: 'Done',
    listLabel: 'Todos',
    progress: '{done} of {total} done',
    remaining: '{count} open',
    markDone: 'Mark "{title}" as done',
    markOpen: 'Mark "{title}" as open',
    delete: 'Delete "{title}"',
    added: 'Added "{title}"',
    deleted: 'Deleted "{title}"',
    clearCompleted: 'Clear done',
    cleared: 'Removed every done todo',
    dueOn: 'Due {date}',
    empty: 'Nothing to do. Add a todo above.',
    priorities: { low: 'Low', normal: 'Normal', high: 'High' },
  },
  todo: {
    title: 'Title',
    notes: 'Notes',
    done: 'Done',
    status: 'Status',
    open: 'Open',
    save: 'Save',
    saved: 'Saved "{title}"',
    delete: 'Delete',
    confirmTitle: 'Delete this todo?',
    confirmBody: '"{title}" goes away for good.',
    cancel: 'Cancel',
    notFound: 'This todo does not exist',
    back: 'Back to the list',
    edit: 'Edit',
    noNotes: 'No notes',
  },
  about: {
    title: 'About this example',
    body: `
This app is a tour of **imp**. Every screen uses a different part of it:

- the **application map** drives the router, the nav, the trail and the page title
- an **HTTP client** with retry, a timeout and an auth interceptor talks to a mock backend
- **state**, **computed** values and keyed lists update the DOM in place
- **translations** switch the whole app between English and Polish
- the **Stats** section is a lazy **area** with its own translations
- the **Clear done** button is behind a **feature flag**
`,
    report: 'Found a problem on this page? Report it.',
  },
  appMap: {
    todos: { label: 'Todos', description: 'The todo list' },
    stats: { label: 'Stats', description: 'How much is done' },
    about: { label: 'About', description: 'What this example shows' },
  },
}
