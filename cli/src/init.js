import { basename, dirname, join, relative, resolve } from '@std/path'
import { VERSION } from './version.js'
import { bold, dim, green } from './colors.js'
import { logger } from './logger.js'
import { impMarkSvg } from '../../lib/src/std/shared/imp-mark.js'

const PWA_THEME_COLOR = '#0f3a5d'
const PWA_BACKGROUND_COLOR = '#ffffff'
const PWA_ICON = 'icon.svg'

const TEMPLATES = new URL('./templates/', import.meta.url)

const readTemplate = (name) => Deno.readTextFile(new URL(name, TEMPLATES))

const readBinaryTemplate = (name) => Deno.readFile(new URL(name, TEMPLATES))

const OFL = 'SIL Open Font License 1.1'

export const SCAFFOLD_FONTS = [
  { name: 'Inter', slug: 'inter', license: OFL },
  { name: 'Manrope', slug: 'manrope', license: OFL },
  { name: 'Plus Jakarta Sans', slug: 'plus-jakarta-sans', license: OFL },
  { name: 'DM Sans', slug: 'dm-sans', license: OFL },
  { name: 'Outfit', slug: 'outfit', license: OFL },
  { name: 'Space Grotesk', slug: 'space-grotesk', license: OFL },
  { name: 'Sora', slug: 'sora', license: OFL },
  { name: 'Figtree', slug: 'figtree', license: OFL },
  { name: 'Nunito Sans', slug: 'nunito-sans', license: OFL },
  { name: 'Work Sans', slug: 'work-sans', license: OFL },
]

export const pickFont = (random = Math.random) =>
  SCAFFOLD_FONTS[Math.floor(random() * SCAFFOLD_FONTS.length)]

export function fontBySlug(slug) {
  const font = SCAFFOLD_FONTS.find((candidate) => candidate.slug === slug)
  if (font) return font
  const known = SCAFFOLD_FONTS.map((candidate) => candidate.slug).join(', ')
  throw new Error(`unknown font '${slug}' - --font takes one of ${known}`)
}

const FONT_SUBSETS = [
  {
    name: 'latin-ext',
    label: 'Latin Extended',
    ranges: [
      'U+0100-02BA',
      'U+02BD-02C5',
      'U+02C7-02CC',
      'U+02CE-02D7',
      'U+02DD-02FF',
      'U+0304',
      'U+0308',
      'U+0329',
      'U+1D00-1DBF',
      'U+1E00-1E9F',
      'U+1EF2-1EFF',
      'U+2020',
      'U+20A0-20AB',
      'U+20AD-20C4',
      'U+2113',
      'U+2C60-2C7F',
      'U+A720-A7FF',
    ],
  },
  {
    name: 'latin',
    label: 'Latin',
    ranges: [
      'U+0000-00FF',
      'U+0131',
      'U+0152-0153',
      'U+02BB-02BC',
      'U+02C6',
      'U+02DA',
      'U+02DC',
      'U+0304',
      'U+0308',
      'U+0329',
      'U+2000-206F',
      'U+20AC',
      'U+2122',
      'U+2191',
      'U+2193',
      'U+2212',
      'U+2215',
      'U+FEFF',
      'U+FFFD',
    ],
  },
]

const fontFile = (font, subset) => `${font.slug}-${subset.name}.woff2`

const fontFaceCss = (font) =>
  FONT_SUBSETS.map((subset) =>
    `@font-face {
  font-family: "${font.name}";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(${fontFile(font, subset)}) format("woff2");
  unicode-range:
    ${subset.ranges.join(',\n    ')};
}
`
  ).join('\n')

const fontStack = (font) => `'${font.name}', system-ui, sans-serif`

const themeJs = (font) =>
  `export default {
  name: 'app-light',
  base: 'imp-light',
  tokens: {
    'font-family': "${fontStack(font)}",
  },
}
`

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
  const config = { version: VERSION, map: 'src/app-map.js' }
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
    <link rel="stylesheet" href="/fonts/fonts.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`

const quoted = (text) => text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const mainJs = `import { init, mount } from 'imp'
import { root } from './app.js'
import theme from './theme.js'

await init({ theme })

mount('#app', root())
`

const appMapJs = () =>
  `import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/', description: 'The counter the scaffold starts with' },
  about: 'Bind this node in src/app.js, or delete it here',
})
`

const appJs = (title) =>
  `import { component } from 'imp'
import { div, p } from 'imp/html'
import { initState } from 'imp/state'
import { router } from 'imp/router'
import { button, heading, text } from 'imp/std'
import { appLogo, shell } from 'imp/std/shell'
import { app } from './app-map.js'

const counter = component('app-counter', {
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

export const root = component('app-root', {
  setup: () =>
    shell(
      { logo: appLogo({ label: '${quoted(title)}' }), navbar: { map: app } },
      router({ map: app, screens: { [app.home]: () => counter() } }),
    ),
})
`

const unitTest = `import { mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'
import { root } from '../src/app.js'

const find = (node, selector) => {
  const scope = node.shadowRoot ?? node
  const direct = scope.querySelector(selector)
  if (direct) return direct
  for (const child of scope.querySelectorAll('*')) {
    const found = child.shadowRoot ? find(child, selector) : null
    if (found) return found
  }
  return null
}

const render = () => {
  mount(document.body, root())
  return document.querySelector('app-root')
}

beforeEach(() => {
  document.body.replaceChildren()
  history.replaceState(null, '', '/')
})

test('starts at zero clicks', () => {
  expect(find(render(), '#clicks').textContent).toEqual('Clicks: 0')
})

test('counts every click', () => {
  const page = render()
  const control = find(find(page, 'imp-button'), 'button')
  control.click()
  control.click()
  expect(find(page, '#clicks').textContent).toEqual('Clicks: 2')
})

test('the map gives every node a screen, bound or not', () => {
  const page = render()
  expect(find(page, 'imp-shell')).toBeTruthy()
  expect(find(page, 'nav a[href="/about"]')).toBeTruthy()
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

async function fontFiles(font) {
  const files = [
    {
      path: 'public/fonts/fonts.css',
      contents: fontFaceCss(font),
      note: `the @font-face rules of ${font.name} - linked from index.html`,
    },
  ]
  for (const subset of FONT_SUBSETS) {
    files.push({
      path: `public/fonts/${fontFile(font, subset)}`,
      contents: await readBinaryTemplate(`fonts/${fontFile(font, subset)}`),
      note: `${font.name}, ${subset.label}`,
    })
  }
  files.push({
    path: `public/fonts/${font.slug}-ofl.txt`,
    contents: await readTemplate(`fonts/${font.slug}-ofl.txt`),
    note: `${font.license} - ships with the font`,
  })
  return files
}

async function templateFiles({ title, pwa, font }) {
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
      note: 'entry point: applies the theme, mounts the frame',
    },
    {
      path: 'src/theme.js',
      contents: themeJs(font),
      note: `the theme: ${font.name} over imp-light - make the palette your own`,
    },
    {
      path: 'src/app-map.js',
      contents: appMapJs(),
      note: 'the application map: every feature of the app, one line each',
    },
    { path: 'src/app.js', contents: appJs(title), note: 'the frame, the router and the counter' },
    { path: 'test/app.test.js', contents: unitTest, note: 'unit test, runs in-process' },
    { path: 'test/app.spec.js', contents: e2eSpec, note: 'e2e spec, runs in a real browser' },
    {
      path: 'public/favicon.svg',
      contents: await readTemplate('favicon.svg'),
      note: 'published at the site root - replace it with your own mark',
    },
    ...await fontFiles(font),
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
      contents: impMarkSvg('light'),
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

function printSummary({ files, label, pwa, font }) {
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
  console.log(
    `\nThe font is ${font.name}, ${font.choice}. An AI agent keeps it and follows ` +
      '`imp skill init`\nto give the app a theme of its own.',
  )
  console.log('Now point your AI agent at `imp skill` and start building!')
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
  if (typeof file.contents === 'string') await Deno.writeTextFile(path, file.contents)
  else await Deno.writeFile(path, file.contents)
  return file
}

export async function init({ cwd, dir = null, pwa = false, font = null }) {
  const chosenFont = font
    ? { ...fontBySlug(font), choice: 'named by --font' }
    : { ...pickFont(), choice: 'picked at random' }
  const target = dir ? resolve(cwd, dir) : cwd
  const label = dir ? relative(cwd, target) || null : null
  const files = await templateFiles({ title: titleFrom(basename(target)), pwa, font: chosenFont })
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
  printSummary({ files: written, label, pwa, font: chosenFont })
}
