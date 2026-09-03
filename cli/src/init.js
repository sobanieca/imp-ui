import { basename, dirname, join, relative, resolve } from '@std/path'
import { VERSION } from './version.js'
import { bold, dim, green } from './colors.js'
import { logger } from './logger.js'

const PWA_THEME_COLOR = '#0f3a5d'
const PWA_BACKGROUND_COLOR = '#ffffff'
const PWA_ICON = 'icon.svg'

const TEMPLATES = new URL('./templates/', import.meta.url)

const readTemplate = (name) => Deno.readTextFile(new URL(name, TEMPLATES))

const DEFAULT_TITLE = 'My imp app'

const titleFrom = (name) => {
  const words = name.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return DEFAULT_TITLE
  return words[0].toUpperCase() + words.slice(1)
}

const SHORT_NAME_LIMIT = 12

const shortNameFrom = (title) =>
  title.length <= SHORT_NAME_LIMIT ? title : title.split(' ')[0].slice(0, SHORT_NAME_LIMIT)

const impConfig = ({ title, pwa }) => {
  const config = { version: VERSION }
  if (pwa) {
    config.pwa = {
      name: title,
      shortName: shortNameFrom(title),
      themeColor: PWA_THEME_COLOR,
      backgroundColor: PWA_BACKGROUND_COLOR,
      display: 'standalone',
      icon: PWA_ICON,
    }
  }
  return `${JSON.stringify(config, null, 2)}\n`
}

const indexHtml = (title) =>
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`

const mainJs = `import { init, mount } from 'imp'
import { app } from './app.js'

await init({ theme: 'imp-light' })

mount('#app', app())
`

const appJs = `import { component } from 'imp'
import { div, p } from 'imp/html'
import { button, heading, text } from 'imp/std'

export const app = component('app-root', {
  setup: (self) => {
    const clicks = initState(self, 'app.clicks', 0)
    return div(
      heading('Hello from imp'),
      text('Edit src/app.js and the page reloads itself.'),
      text(
        'Now point your AI agent at ',
        text({ inline: true, weight: 'bold' }, 'imp skill'),
        ' and start building!',
      ),
      p({ id: 'clicks' }, clicks.text((value) => \`Clicks: \${value}\`)),
      button(
        { variant: 'primary', events: { click: () => clicks.set((value) => value + 1) } },
        'Click me',
      ),
    )
  },
})
`

const unitTest = `import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'
import { app } from '../src/app.js'
import { initState } from 'imp/state'

const inside = (node, selector) => node.shadowRoot.querySelector(selector)

const render = () => {
  mount(document.body, app())
  return document.querySelector('app-root')
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('starts at zero clicks', () => {
  expect(inside(render(), '#clicks').textContent).toEqual('Clicks: 0')
})

test('counts every click', () => {
  const root = render()
  const control = inside(inside(root, 'imp-button'), 'button')
  control.click()
  control.click()
  expect(inside(root, '#clicks').textContent).toEqual('Clicks: 2')
})
`

const e2eSpec = `import { expect, test } from 'imp/test'

const clicks = (page) => page.$eval('#clicks', (node) => node.textContent)

test('renders the app', async ({ page }) => {
  expect(await page.$eval('h1', (node) => node.textContent)).toEqual('Hello from imp')
  expect(await clicks(page)).toEqual('Clicks: 0')
})

test('counts a click', async ({ page }) => {
  await page.click('imp-button >>> button')
  expect(await clicks(page)).toEqual('Clicks: 1')
})
`

const gitignore = `# imp writes these - never commit them
dist/
.imp/

# environment files hold secrets and per-developer values
.env
.env.*

# dependencies/ is committed on purpose: vendored packages are part of the repo

# Node.js and general JS tooling, for the parts of your workflow that use it
node_modules/
*.log

# OS and editor noise
.DS_Store
Thumbs.db
*.swp
.idea/
`

const GITIGNORE = '.gitignore'

const ignoreEntries = (text) =>
  text.split('\n').map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))

const withoutSlashes = (entry) => entry.replace(/^\/+/, '').replace(/\/+$/, '')

const GLOBSTAR = '\u0000'

function ignoreMatcher(entry) {
  const escaped = withoutSlashes(entry).replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const source = escaped.replaceAll('**', GLOBSTAR).replaceAll('*', '[^/]*')
    .replaceAll(GLOBSTAR, '.*').replaceAll('?', '[^/]')
  return new RegExp(`^${source}$`)
}

function entriesMissingFrom(existing) {
  const covered = ignoreEntries(existing).filter((entry) => !entry.startsWith('!'))
    .map(ignoreMatcher)
  return ignoreEntries(gitignore)
    .filter((entry) => !covered.some((matcher) => matcher.test(withoutSlashes(entry))))
}

const appendedGitignore = (existing, missing) =>
  `${existing.endsWith('\n') ? existing : `${existing}\n`}\n# added by imp init\n${
    missing.join('\n')
  }\n`

async function templateFiles({ title, pwa }) {
  const files = [
    {
      path: 'imp.json',
      contents: impConfig({ title, pwa }),
      note: `the one config file - pins imp ${VERSION}`,
    },
    { path: 'index.html', contents: indexHtml(title), note: 'the page imp serves' },
    {
      path: 'src/main.js',
      contents: mainJs,
      note: 'entry point: applies the theme, mounts the app',
    },
    { path: 'src/app.js', contents: appJs, note: "the app's components" },
    { path: 'test/app.test.js', contents: unitTest, note: 'unit test, runs in-process' },
    { path: 'test/app.spec.js', contents: e2eSpec, note: 'e2e spec, runs in a real browser' },
    {
      path: 'public/favicon.svg',
      contents: await readTemplate('favicon.svg'),
      note: 'published at the site root - replace it with your own mark',
    },
    {
      path: GITIGNORE,
      contents: gitignore,
      merge: true,
      note: 'dist/, .imp/ and every .env file',
    },
  ]
  if (pwa) {
    files.push({
      path: PWA_ICON,
      contents: await readTemplate('icon.svg'),
      note: 'the source image imp renders the whole PWA icon set from',
    })
  }
  return files
}

async function pathExists(path) {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

function noteFor(file) {
  if (!file.appended) return file.note
  if (file.appended.length === 0) return 'left as it was - it already covers all of these'
  const count = file.appended.length
  return `kept yours - appended the ${count} ${count > 1 ? 'entries' : 'entry'} it was missing`
}

function printSummary({ files, label, pwa }) {
  const width = Math.max(...files.map((file) => file.path.length))
  const where = label ? ` in ${label}` : ' here'
  console.log(`${green('Created a new imp project')}${where}.\n`)
  for (const file of files) {
    console.log(`  ${bold(file.path.padEnd(width))}  ${dim(noteFor(file))}`)
  }
  const appended = files.find((file) => file.appended?.length > 0)
  if (appended) {
    console.log('')
    logger.warn(
      `${GITIGNORE} already existed - appended ${
        appended.appended.join(', ')
      } to it and left everything else in it untouched`,
    )
  }
  console.log(`\n${bold('Next steps:')}`)
  if (label) console.log(`  cd ${label}`)
  console.log(`  imp start        ${dim('serve the app with live reload')}`)
  console.log(`  imp test --unit  ${dim('run the unit test (--e2e for the browser spec)')}`)
  if (pwa) {
    console.log(`  imp build --pwa  ${dim('build an installable, offline app into dist/')}`)
  }
  console.log(`  imp skill        ${dim("read imp's manuals - an AI agent starts here")}`)
  console.log('\nNow point your AI agent at `imp skill` and start building!')
}

async function writeFile(target, file) {
  const path = join(target, file.path)
  if (file.merge && await pathExists(path)) {
    const existing = await Deno.readTextFile(path)
    const missing = entriesMissingFrom(existing)
    if (missing.length > 0) await Deno.writeTextFile(path, appendedGitignore(existing, missing))
    return { ...file, appended: missing }
  }
  await Deno.mkdir(dirname(path), { recursive: true })
  await Deno.writeTextFile(path, file.contents)
  return file
}

export async function init({ cwd, dir = null, pwa = false }) {
  const target = dir ? resolve(cwd, dir) : cwd
  const label = dir ? relative(cwd, target) || null : null
  const files = await templateFiles({ title: titleFrom(basename(target)), pwa })
  const conflicts = []
  for (const file of files) {
    if (!file.merge && await pathExists(join(target, file.path))) conflicts.push(file.path)
  }
  if (conflicts.length > 0) {
    throw new Error(
      `imp init writes ${conflicts.join(', ')}, which already ${
        conflicts.length > 1 ? 'exist' : 'exists'
      }${
        label ? ` in ${label}` : ' here'
      } - nothing was written. Scaffold into an empty directory ` +
        `instead ('imp init <dir>'), or move those files aside.`,
    )
  }
  const written = []
  for (const file of files) written.push(await writeFile(target, file))
  printSummary({ files: written, label, pwa })
}
