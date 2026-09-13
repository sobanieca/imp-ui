import { codeBlock } from 'imp/std/display'
import { stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Code block'
export const group = groups.display

const counter = `
import { component } from 'imp'
import { button, div, span } from 'imp/html'
import { initState } from 'imp/state'

// A counter with a minus and a plus button.
export const counter = component('demo-counter', {
  setup: (self, { start = 0 } = {}) => {
    const count = initState(self, 'demo.count', start)
    return div(
      { class: 'counter' },
      button({ events: { click: () => count.set((n) => n - 1) } }, '-'),
      span(count.text()),
      button({ events: { click: () => count.set((n) => n + 1) } }, '+'),
    )
  },
})
`

const install = `
#!/usr/bin/env bash
set -euo pipefail

# Install imp into ~/.imp/bin and put it on the PATH.
IMP_HOME="\${IMP_HOME:-$HOME/.imp}"
mkdir -p "$IMP_HOME/bin"
curl -fsSL https://imp.dev/install.sh | bash -s -- --to "$IMP_HOME/bin"

if ! command -v imp > /dev/null; then
  echo "add $IMP_HOME/bin to your PATH"
  exit 1
fi
imp --version
`

const page = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>imp app</title>
    <style>
      body { margin: 0; font-family: system-ui; }
      .hero { padding: 2rem; background: #f8fafc; }
    </style>
  </head>
  <body>
    <!-- imp mounts the app here -->
    <main id="app" class="hero"></main>
    <script type="module">
      import { init } from 'imp'
      await init({ theme: 'imp-light' })
    </script>
  </body>
</html>
`

const query = `
-- Overdue invoices per customer
SELECT c.name, COUNT(*) AS overdue, SUM(i.total) AS amount
FROM invoices i
JOIN customers c ON c.id = i.customer_id
WHERE i.due_on < CURRENT_DATE AND i.paid_at IS NULL
GROUP BY c.name
HAVING COUNT(*) > 1
ORDER BY amount DESC
LIMIT 20;
`

const config = `
# The dev server and the build, side by side
server:
  port: 4516
  open: true
build:
  target: ./dist
  minify: true
  formats: [esm, iife]
themes:
  - name: brand
    primary: "#8821ac"
`

const change = `
diff --git a/lib/src/std/index.js b/lib/src/std/index.js
--- a/lib/src/std/index.js
+++ b/lib/src/std/index.js
@@ -1,4 +1,5 @@
 export { card } from './card.js'
+export { codeBlock } from './code-block.js'
 export { emptyState } from './empty-state.js'
-export { pill } from './pill.js'
 export { tag } from './tag.js'
`

const guide = `
# Getting started

Run \`imp init my-app\`, then start the dev server:

\`\`\`sh
cd my-app
imp start
\`\`\`

- **No build step.** The browser runs your modules as written.
- See the [components](https://imp.dev/docs/std-components) for the catalog.
`

export const javascript = {
  scenario: 'JavaScript',
  component: codeBlock({ language: 'js', code: counter }),
}

export const withLineNumbers = {
  scenario: 'With line numbers',
  component: codeBlock({ language: 'js', lineNumbers: true, id: 'counter', code: counter }),
}

export const shellScript = {
  scenario: 'Shell script',
  component: codeBlock({ language: 'bash', lineNumbers: true, id: 'install', code: install }),
}

export const html = {
  scenario: 'HTML with embedded CSS and JS',
  component: codeBlock({ language: 'html', code: page }),
}

export const sql = {
  scenario: 'SQL',
  component: codeBlock({ language: 'sql', code: query }),
}

export const yamlAndDiff = {
  scenario: 'YAML and a diff',
  component: stack(
    { gap: 4 },
    codeBlock({ language: 'yaml', label: 'imp.yaml', code: config }),
    codeBlock({ language: 'diff', label: 'The change', code: change }),
  ),
}

export const markdown = {
  scenario: 'Markdown',
  component: codeBlock({ language: 'md', code: guide }),
}

export const plainText = {
  scenario: 'Plain text',
  component: codeBlock({
    code: 'No language given. The text is shown as it is, with a copy button.',
  }),
}
