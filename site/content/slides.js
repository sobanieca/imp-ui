export const slides = [
  {
    key: 'buildless',
    eyebrow: 'No build step',
    title: 'The browser runs the file that you typed',
    lead: 'There is no compile step, no JSX and no virtual DOM. A component is a plain function ' +
      'that returns a real DOM node.',
    points: [
      'One binary holds the dev server, the test runner, the linter, the formatter and the ' +
      'dependency manager.',
      'A unit test runs in process, with no browser. An end-to-end test runs in a real headless ' +
      'Chrome, and a spec records itself as a GIF.',
      'Production is the one place where a build exists. It emits plain static files.',
    ],
    code: {
      language: 'sh',
      source: `imp start          # serve the source that you typed
imp test --unit    # every *.test.js, in process
imp test --e2e     # every *.spec.js, in a real browser
imp lint --fix     # one rule set, with autofixes
imp fmt            # one formatter`,
    },
  },
  {
    key: 'state',
    eyebrow: 'State',
    title: 'State lives in the parent component',
    lead: 'A component initializes a named state. Every component under it reads the same state ' +
      'by name.',
    points: [
      'There is no store to configure, no provider to wrap and no re-render.',
      'A change updates only the DOM that you bound to it.',
      'The state lives as long as its component stays mounted.',
    ],
    figure: 'state',
  },
  {
    key: 'component',
    eyebrow: 'Components',
    title: 'A component is a web component',
    lead: 'The name that you choose is the HTML tag. The component renders into its own shadow ' +
      'root.',
    points: [
      'The setup runs after the browser connects the element, so the state of a parent is ' +
      'already there.',
      'You call a component like any element factory, and you pass it the same kinds of ' +
      'arguments.',
    ],
    code: {
      language: 'js',
      source: `import { component } from 'imp'
import { button, div, span } from 'imp/html'
import { initState } from 'imp/state'

export const counter = component('app-counter', {
  setup: (self) => {
    const count = initState(self, 'app.count', 0)
    return div(
      span(count.text()),
      button('+1', { events: { click: () => count.set((n) => n + 1) } }),
    )
  },
})`,
    },
  },
  {
    key: 'styling',
    eyebrow: 'Styling',
    title: 'The styles stay inside the component',
    lead: 'A styles key holds the CSS of the component. The shadow root keeps it there, and ' +
      'nothing leaks out.',
    points: [
      'Every colour, length and font reads an --imp-* token. A theme change reaches your ' +
      'component with no code.',
      'Logical properties make the component correct in both text directions.',
    ],
    code: {
      language: 'js',
      source: `export const panel = component('app-panel', {
  styles: \`
    :host { display: block }
    .panel {
      padding: var(--imp-space-4, 16px);
      border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
      border-radius: var(--imp-radius-container, 10px);
      background: var(--imp-color-surface, #ffffff);
    }
  \`,
  setup: (_self, ...children) => div({ class: 'panel' }, ...children),
})`,
    },
  },
  {
    key: 'dev-server',
    eyebrow: 'Dev server',
    title: 'A dev server that an agent can read',
    lead: 'The browser console, every error and every request stream to your terminal.',
    points: [
      'The whole session lands in a plain text log. imp logs -f follows it.',
      'The review widget sits on every page. Click an element, describe what is wrong, and imp ' +
      'writes a text file with the page and the element.',
      'Your agent reads the reviews with imp review, so it does not guess what you meant.',
    ],
    code: {
      language: 'sh',
      source: `imp logs -f
imp logs | grep '[browser:error]'
imp review`,
    },
  },
  {
    key: 'std',
    eyebrow: 'Standard library',
    title: 'A rich standard component library',
    lead: 'Forms, tables, overlays, navigation, charts, icons and the app frame ship inside imp.',
    points: [
      'Every component is themed, translated, accessible, and tested in both text directions.',
      'Icons are built in, and you pay only for the ones that you draw.',
      'A real app ships with zero external dependencies.',
    ],
    code: {
      language: 'js',
      source: `import { button, comboBox, dialog, icon, table, tabs } from 'imp/std'
import { luSearch } from 'imp/icons'

button({ variant: 'primary', events: { click: search } }, icon(luSearch), 'Search')`,
    },
  },
  {
    key: 'map',
    eyebrow: 'The app map',
    title: 'The whole app on one screen',
    lead: 'One file names every screen, its path and its purpose. The router binds a component ' +
      'to each node.',
    points: [
      'imp map prints the tree, so a person and an agent read the same plan.',
      'A node with no screen yet renders a placeholder, so the plan runs before the code exists.',
    ],
    code: {
      language: 'js',
      source: `import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', description: 'The welcome page' },
  todos: { $id: 'One todo, on its own page' },
  about: 'Who made this, and why',
})`,
    },
  },
  {
    key: 'mocks',
    eyebrow: 'Mocks',
    title: 'A backend that does not exist yet',
    lead: 'Point imp.json at a folder of *.mock.js files. The dev server answers the requests ' +
      'itself.',
    points: [
      'The app runs before the first endpoint exists.',
      'The end-to-end tests run against the same mocks.',
      'One flag switches the same app to the real API.',
    ],
    code: {
      language: 'js',
      source: `export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 800,
    handler: () => [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }],
  },
]`,
    },
  },
  {
    key: 'cli',
    eyebrow: 'CLI',
    title: 'One command line for the whole loop',
    lead: 'Every step of a project is a subcommand of imp. There is nothing to connect.',
    points: [
      'Scaffold, serve, test, lint, format, preview, review, build, install and update come ' +
      'from one binary.',
      'imp update pins the version of imp in the project, so every clone runs the same imp.',
    ],
    code: {
      language: 'sh',
      source: `imp init my-app       # a real app, and it runs
imp start             # serve it, with mocks
imp preview           # every component, in isolation
imp test --unit       # unit tests
imp test --e2e        # end-to-end tests
imp lint              # check the code
imp fmt               # format the code
imp build             # static files, for any CDN
imp install marked    # vendor a dependency`,
    },
  },
  {
    key: 'skill',
    eyebrow: 'imp skill',
    title: 'The manual, written for your agent',
    lead: 'imp skill prints a manual out of the binary, at the exact version that the project ' +
      'runs.',
    points: [
      'It works offline, and it makes no network call.',
      'The index costs one call. A subject costs one more.',
      'Your own components ship a skill file next to them, and the same command prints it.',
    ],
    code: {
      language: 'sh',
      source: `imp skill                  # the index
imp skill state routing    # two manuals in one call
imp skill std/button       # a standard component
imp skill ./components/counter.js`,
    },
  },
  {
    key: 'analytics',
    eyebrow: 'Analytics',
    title: 'See which parts of the UI work',
    lead: 'imp records the pages, the zones and the outcomes of your app, and gives each record ' +
      'to a sink that you register.',
    points: [
      'Every view of a page is recorded, with no code per route.',
      'A zone measures any part of a screen, with no code in the component.',
      'The records go to any store: Google Analytics, PostHog or your own endpoint.',
      'imp stores no id on the device.',
    ],
    code: {
      language: 'js',
      source: `import { onAnalytics, track, zone } from 'imp/analytics'

onAnalytics((record) => console.log(record))

zone({ name: 'due-date' }, dueDatePicker())

track('invoice-sent')`,
    },
  },
  {
    key: 'build',
    eyebrow: 'Ship',
    title: 'Build once, host anywhere',
    lead: 'imp build writes plain static files into dist/. Upload the folder as it is.',
    points: [
      'There is no runtime, no import map and no server to run.',
      'What you tested in development is what you ship.',
      'Add --pwa for an installable app that works offline.',
    ],
    code: {
      language: 'sh',
      source: `imp build
imp build --pwa`,
    },
  },
]
