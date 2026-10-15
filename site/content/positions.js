export const positions = [
  {
    title: 'Your idea is the best app ever, in your head',
    lead: 'Build it as soon as you can, and validate it on the market.',
    text:
      'Do not spend the first weeks on tools and on how to connect them. imp is the whole '
      + 'frontend in one binary. Ship the idea, then learn from the people who use it.',
    equation: [
      { icon: 'appWindow', label: 'Frontend' },
      { icon: 'server', label: 'Backend' },
      { icon: 'rocket', label: 'App' },
    ],
  },
  {
    title: 'imp is a boring project, on purpose',
    lead:
      'It aims to be the correct fit for most applications, and good enough where it is '
      + 'not perfect.',
    text:
      'It does not chase the smallest bundle, and nobody tuned it to win a benchmark. A '
      + 'boring tool is a tool that you stop thinking about. imp solves the frontend half of the '
      + 'app, and it stays out of the other half.',
  },
  {
    title: 'The SPA is the best thing that happened to the IT industry',
    lead:
      'A single-page application, or SPA, is a frontend that stands on its own. It asks '
      + 'the backend for data only.',
    text:
      'Many companies push a render server into every app, and you pay them to render '
      + 'what a browser renders for nothing. The SPA is the way to go. imp promotes it first, '
      + 'and it works in a server-rendered page too. Build a component as a JS entry, and the '
      + 'HTML that your server returns embeds it as an interactive island.',
    tags: [
      { icon: 'split', label: 'Frontend apart from backend' },
      { icon: 'zap', label: 'State on the client' },
      { icon: 'bug', label: 'Debug in the browser' },
      { icon: 'wifiOff', label: 'Works offline' },
    ],
    link: {
      href: '/docs/cli#imp-build',
      label: 'Build a page or a component',
    },
  },
  {
    title: 'Nobody writes code by hand anymore',
    lead: 'AI changes what "best practice" means.',
    text:
      'Many tools of today cover a gap that JavaScript has since closed, and somebody '
      + 'designed them for code that a person types. When an agent writes the code and maintains '
      + 'it, those constraints no longer apply in the same way. So imp returns to techniques that '
      + 'people once called bad practice, and uses them well.',
  },
  {
    title: 'Where the standard components end, the agent continues',
    lead:
      'imp does not try to ship every component. With the correct constraints, an agent '
      + 'generates the missing one.',
    text:
      'A kanban board or a seat map is a component of yours. The agent writes it on the '
      + 'foundations of imp: the theme tokens, the state, the translations and the accessibility '
      + 'rules. `imp skill` hands it those rules, so the result fits next to a standard component.',
    link: {
      href: '/docs/custom-components',
      label: 'How a component of yours fits in',
    },
  },
  {
    title: 'The PWA is the app that installs from a URL',
    lead: 'A Progressive Web App is a promising technology, and imp supports it in full.',
    text:
      'One build flag emits the manifest, the icon set and an offline service worker. The '
      + 'app installs to a home screen from a link, with no store and no second codebase. It is '
      + 'where the SPA position leads.',
    link: {
      href: '/docs/cli#progressive-web-app---imp-build---pwa',
      label: 'Build a PWA',
    },
  },
]
