import { fromFileUrl, join } from '@std/path'
import { marked } from '../cli/src/vendor/marked.js'
import { GEOMETRY_SQUARES, geometryStyles, markdownStyles } from '../cli/src/design-styles.js'
import { buildTokens, THEME_DEFAULTS } from '../lib/src/theme.js'
import { MAIN_1, MAIN_2, MAIN_3, previewLook } from '../lib/src/std/preview-look.js'
import { languageNameOf } from '../lib/src/std/display/code-languages.js'
import { tokenizeLines } from '../lib/src/std/display/code-tokens.js'
import { tokenNodes, tokenStyles } from '../lib/src/std/display/code-css.js'
import { luMoon, luSun } from '../lib/src/icons/lucide-icons.js'
import { impMarkSvg } from '../lib/src/std/shared/imp-mark.js'
import {
  overviewScript,
  overviewStyles,
  renderInstall,
  renderNotice,
  renderPositions,
  renderTour,
  renderWorkflow,
} from './build-overview.js'
import { slides } from '../site/content/slides.js'
import { steps, stepsNote } from '../site/content/steps.js'
import { positions } from '../site/content/positions.js'
import { runImp } from './imp.js'

const ROOT = fromFileUrl(new URL('..', import.meta.url))
const DOCS = join(ROOT, 'docs')
const SITE = join(ROOT, 'site')
const DIST = join(SITE, 'dist')
const OVERVIEW = join(SITE, 'content', 'overview.md')
const FONTS = join(ROOT, 'lib', 'src', 'public', 'fonts')
const ORIGIN = Deno.env.get('IMP_SITE_URL')?.replace(/\/$/, '') ?? null
const INSTALL_ORIGIN = ORIGIN ?? 'https://sobanieca.github.io/imp-ui'
const INSTALL_SCRIPTS = ['install.sh', 'install.ps1']

const SCHEME_STORAGE_KEY = 'imp.site.scheme'
const SCHEMES = ['light', 'dark']
const THEME_OF_SCHEME = { light: 'imp-light', dark: 'imp-dark' }

const INK = '#101010'
const ON_INK = '#ffffff'
const ON_INK_MUTED = '#a3a3ad'
const BAR_BLOCK_SIZE = '56px'
const NARROW = '(width < 56.25rem)'

const PAGE_ORDER = [
  'cli',
  'config',
  'imports',
  'rendering',
  'components',
  'custom-components',
  'std-components',
  'accessibility',
  'state',
  'routing',
  'theming',
  'i18n',
  'http',
  'logging',
  'analytics',
  'feature-flags',
  'testing',
  'lint',
  'fmt',
  'dependencies',
  'deploy',
  'browser-support',
]

const COPIES = [['cli/src/templates/favicon.ico', 'favicon.ico']]

const MARKS = [['mark-dark.svg', 'dark'], ['mark-light.svg', 'light']]

const SECTIONS = [
  { href: '/', label: 'Overview', isCurrent: (route) => route === '' },
  { href: '/components', label: 'Components', isCurrent: (route) => route === 'components' },
  { href: '/docs', label: 'Docs', isCurrent: (route) => route.startsWith('docs') },
]

const TITLE_PREFIX = /^imp(-ui)? - /
const DOC_LINK = /^([\w-]+)\.md(#.*)?$/
const DESCRIPTION_LIMIT = 160
const FLAGS_GLOBAL = /__IMP_FLAGS__/g
const SECTION_START = /(?=<h2 )/
const INSTALL_SLOT = '<!-- install -->'
const NOTICE_SLOT = '<!-- notice -->'
const OVERVIEW_SLOT = /^<!-- (tour|workflow|positions) -->$/m
const OVERVIEW_BLOCKS = {
  tour: () => renderTour(slides, highlight),
  workflow: () => renderWorkflow(steps, stepsNote),
  positions: () => renderPositions(positions),
}

const escape = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

const slugOfHeading = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const highlight = (source, language) => {
  const name = language === undefined ? null : languageNameOf(language)
  const lines = tokenizeLines(source, name ?? 'text')
  return lines
    .map((line) =>
      tokenNodes(line, (className, text) => `<span class="${className}">${escape(text)}</span>`)
        .map((
          node,
        ) => (typeof node === 'string' && !node.startsWith('<span') ? escape(node) : node))
        .join('')
    )
    .join('\n')
}

const docsRenderer = {
  heading({ tokens, depth }) {
    const html = this.parser.parseInline(tokens)
    return `<h${depth} id="${slugOfHeading(html)}">${html}</h${depth}>\n`
  },
  link({ href, title, tokens }) {
    const html = this.parser.parseInline(tokens)
    const doc = href.match(DOC_LINK)
    const target = doc ? `/docs/${doc[1]}${doc[2] ?? ''}` : href
    const external = /^[a-z][a-z0-9+.-]*:/i.test(target)
    const attributes = [
      `href="${target}"`,
      title ? `title="${title}"` : '',
      external ? 'target="_blank" rel="noopener"' : '',
    ].filter(Boolean).join(' ')
    return `<a ${attributes}>${html}</a>`
  },
  code({ text, lang }) {
    const language = lang?.match(/^\S+/)?.[0]
    return `<pre class="code"><code>${highlight(text, language)}</code></pre>\n`
  },
}

marked.use({ renderer: docsRenderer })

const readTitle = (markdown) => markdown.match(/^# (.+)$/m)?.[1] ?? ''

const textOf = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

const readDescription = (html) => {
  const paragraph = html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? ''
  const text = textOf(paragraph)
  if (text.length <= DESCRIPTION_LIMIT) return text
  return `${text.slice(0, DESCRIPTION_LIMIT - 3).replace(/\s+\S*$/, '')}...`
}

const withoutFlagsGlobal = (html) => html.replace(FLAGS_GLOBAL, '__IMP&#95;FLAGS__')

const renderDocs = async () => {
  const pages = []
  for (const slug of PAGE_ORDER) {
    const markdown = await Deno.readTextFile(join(DOCS, `${slug}.md`))
    const title = readTitle(markdown)
    const html = withoutFlagsGlobal(marked.parse(markdown))
    pages.push({
      slug,
      title,
      label: title.replace(TITLE_PREFIX, ''),
      description: readDescription(html),
      html,
    })
  }
  return pages
}

const wrapOverview = (html, withHero) => {
  const chunks = html.split(SECTION_START)
  return chunks.map((chunk, index) =>
    withHero && index === 0
      ? `<div class="hero">${
        chunk.replace(NOTICE_SLOT, renderNotice()).replace(
          INSTALL_SLOT,
          renderInstall(INSTALL_ORIGIN),
        )
      }</div>`
      : `<section class="section">${chunk}</section>`
  ).join('')
}

const renderOverview = async () => {
  const markdown = await Deno.readTextFile(OVERVIEW)
  const parts = markdown.split(OVERVIEW_SLOT)
  const html = parts.map((part, index) => {
    if (index % 2 === 1) return OVERVIEW_BLOCKS[part]()
    if (part.trim() === '') return ''
    return wrapOverview(marked.parse(part), index === 0)
  }).join('')
  return { description: readDescription(marked.parse(parts[0])), html }
}

const readVersion = async () => JSON.parse(await Deno.readTextFile(join(ROOT, 'deno.json'))).version

const tokensOf = (scheme) => ({
  ...buildTokens({ ...THEME_DEFAULTS, mode: scheme }),
  ...previewLook(scheme),
})

const tokenRules = (tokens) =>
  Object.entries(tokens).map(([name, value]) => `  --imp-${name}: ${value};`).join('\n')

const stylesheet = () => `
:root {
${tokenRules(tokensOf('light'))}
  color-scheme: light;
}

:root[data-scheme='dark'] {
${tokenRules(tokensOf('dark'))}
  color-scheme: dark;
}

html {
  background: var(--imp-background-app);
  color: var(--imp-color-text);
}

body {
  display: flex;
  flex-direction: column;
  block-size: 100dvb;
  margin: 0;
  font-family: var(--imp-font-family);
  font-weight: var(--imp-font-weight-normal);
  line-height: var(--imp-line-height-normal);
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--imp-space-6);
  flex: none;
  box-sizing: border-box;
  block-size: ${BAR_BLOCK_SIZE};
  padding-inline: var(--imp-space-4) 0;
  background: ${INK};
  color: ${ON_INK};
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--imp-space-2);
  color: ${ON_INK};
  text-decoration: none;
  font-family: var(--imp-font-family-heading);
  font-weight: var(--imp-font-weight-bold);
  font-size: var(--imp-font-size-lg);
}

.brand img {
  inline-size: 28px;
  block-size: 28px;
}

.bar :focus-visible {
  outline: var(--imp-focus-ring-width) solid ${ON_INK};
  outline-offset: 2px;
}

.links {
  display: flex;
  gap: var(--imp-space-5);
  align-self: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
}

.links a {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  block-size: 100%;
  padding-block-start: 2px;
  border-block-end: 2px solid transparent;
  color: ${ON_INK_MUTED};
  text-decoration: none;
  font-size: var(--imp-font-size-md);
}

.links a:hover { color: ${ON_INK} }

.links a[aria-current='page'] {
  color: ${ON_INK};
  border-block-end-color: ${MAIN_1};
}

.end {
  display: flex;
  align-items: center;
  gap: var(--imp-space-3);
  align-self: stretch;
  margin-inline-start: auto;
}

.scheme {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 32px;
  block-size: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--imp-radius-item);
  background: transparent;
  color: ${ON_INK};
  cursor: pointer;
}

.scheme:hover { background: #2a2a2e }

.scheme svg {
  inline-size: 1rem;
  block-size: 1rem;
}

:root[data-scheme='dark'] .scheme .moon,
:root:not([data-scheme='dark']) .scheme .sun { display: none }

.version {
  color: ${ON_INK_MUTED};
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-sm);
}

.bars {
  display: flex;
  gap: 6px;
  align-self: stretch;
  margin-inline-start: var(--imp-space-2);
  padding-inline-end: 6px;
}

.bars div { inline-size: 10px }
.bars .main-1 { inline-size: 14px; background: ${MAIN_1} }
.bars .main-2 { background: ${MAIN_2} }
.bars .main-3 { background: ${MAIN_3} }

.canvas {
  position: relative;
  flex: 1 1 auto;
  min-block-size: 0;
  overflow: hidden;
  background: var(--imp-background-app);
}

${geometryStyles('.corner')}

main {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  box-sizing: border-box;
  block-size: 100%;
  overflow: auto;
  scrollbar-width: thin;
}

${markdownStyles}

.md { max-inline-size: none }

.md h1,
.md h2 { font-family: var(--imp-font-family-heading) }

.md h1 { font-size: var(--imp-font-size-2xl) }

.md pre.code {
  box-sizing: border-box;
  margin-block: var(--imp-space-3);
  padding: var(--imp-space-3);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-container);
  background: var(--imp-color-surface);
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-sm);
  line-height: var(--imp-line-height-normal);
  overflow: auto;
}

.md pre.code code {
  padding: 0;
  border-radius: 0;
  background: none;
  font-size: inherit;
}
${tokenStyles()}
${overviewStyles}
.overview {
  box-sizing: border-box;
  max-inline-size: 1040px;
  padding: var(--imp-space-6);
}

.hero {
  max-inline-size: 44rem;
  padding-block: var(--imp-space-6) var(--imp-space-7, 48px);
}

.hero h1 {
  margin: 0 0 var(--imp-space-4);
  font-size: clamp(2rem, 1.2rem + 3vw, 3.25rem);
  line-height: var(--imp-line-height-tight);
}

.hero p {
  margin: 0 0 var(--imp-space-5);
  font-size: var(--imp-font-size-lg);
}

.hero p:last-child {
  display: flex;
  flex-wrap: wrap;
  gap: var(--imp-space-3);
  margin: 0;
}

.hero p:last-child a {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  min-block-size: 40px;
  padding-inline: var(--imp-space-4);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-item);
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  text-decoration: none;
  font-size: var(--imp-font-size-md);
  font-weight: var(--imp-font-weight-bold);
}

.hero p:last-child a:first-child {
  border-color: var(--imp-color-primary);
  background: var(--imp-color-primary);
  color: var(--imp-color-on-primary);
}

.section {
  box-sizing: border-box;
  margin-block-end: var(--imp-space-6);
  padding: var(--imp-space-6);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-container);
  background: var(--imp-color-surface);
}

.section h2 {
  margin: 0 0 var(--imp-space-3);
  font-size: var(--imp-font-size-xl);
}

.section p,
.section li { max-inline-size: 70ch }

.section > :last-child { margin-block-end: 0 }

.imp-name {
  font-family: var(--imp-font-family-mono);
  font-size: 0.95em;
  white-space: nowrap;
}

.imp-name img {
  inline-size: 1.3em;
  block-size: 1.3em;
  margin-inline-end: 0.15em;
  vertical-align: -0.3em;
}

:root[data-scheme='dark'] .imp-name .imp-mark-light,
:root:not([data-scheme='dark']) .imp-name .imp-mark-dark { display: none }

.section ol li::marker {
  font-family: var(--imp-font-family-mono);
  color: var(--imp-color-secondary);
}

.docs {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: var(--imp-space-6);
  box-sizing: border-box;
  max-inline-size: 1040px;
  padding: var(--imp-space-6);
}

.pages {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  position: sticky;
  inset-block-start: var(--imp-space-6);
  align-self: start;
}

.pages a {
  display: flex;
  align-items: center;
  gap: var(--imp-space-3);
  padding-block: var(--imp-space-1);
  padding-inline: var(--imp-space-2);
  border-radius: var(--imp-radius-item);
  color: var(--imp-color-text);
  text-decoration: none;
  font-size: var(--imp-font-size-md);
}

.pages a:hover { background: var(--imp-color-surface-sunken) }

.pages a::before {
  content: '';
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  background: var(--imp-color-border);
}

.pages a[aria-current='page']::before { background: ${MAIN_1} }

.paper {
  box-sizing: border-box;
  min-inline-size: 0;
  padding: var(--imp-space-6);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-container);
  background: var(--imp-color-surface);
}

.paper h1 { margin-block-start: 0 }

imp-preview {
  display: block;
  block-size: calc(100dvb - ${BAR_BLOCK_SIZE});
}

.hero p:last-child a:focus-visible,
main a:focus-visible,
.pages a:focus-visible {
  outline: var(--imp-focus-ring-width) solid ${MAIN_1};
  outline-offset: 2px;
}

@media ${NARROW} {
  .bar {
    gap: var(--imp-space-4);
    padding-inline-start: var(--imp-space-3);
  }

  .brand span,
  .version { display: none }

  .links { gap: var(--imp-space-4) }

  .end { gap: var(--imp-space-2) }

  .docs {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--imp-space-4);
  }

  .pages {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
`

const clientScript = () =>
  `const STORAGE_KEY = ${JSON.stringify(SCHEME_STORAGE_KEY)}
const THEME_OF_SCHEME = ${JSON.stringify(THEME_OF_SCHEME)}
const root = document.documentElement

const schemeOfTheme = (name) =>
  Object.keys(THEME_OF_SCHEME).find((scheme) => THEME_OF_SCHEME[scheme] === name) ?? null

const labelOf = (scheme) => scheme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'

const toggle = document.querySelector('.scheme')
const preview = document.querySelector('imp-preview')

const apply = (scheme) => {
  root.dataset.scheme = scheme
  toggle.setAttribute('aria-label', labelOf(scheme))
  preview?.setAttribute('theme', THEME_OF_SCHEME[scheme])
  try {
    localStorage.setItem(STORAGE_KEY, scheme)
  } catch {
    return
  }
}

apply(root.dataset.scheme)
toggle.addEventListener('click', () => apply(root.dataset.scheme === 'dark' ? 'light' : 'dark'))
preview?.addEventListener('imp-preview-theme', (event) => {
  const scheme = schemeOfTheme(event.detail)
  if (scheme !== null && scheme !== root.dataset.scheme) apply(scheme)
})
`

const earlyScript = () =>
  `<script>
      let scheme = null
      try {
        scheme = localStorage.getItem(${JSON.stringify(SCHEME_STORAGE_KEY)})
      } catch {
        scheme = null
      }
      if (!${JSON.stringify(SCHEMES)}.includes(scheme)) {
        scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      document.documentElement.dataset.scheme = scheme
    </script>`

const svgIcon = (className, elements) =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  elements.map(([tag, attributes]) =>
    `<${tag} ${
      Object.entries(attributes).map(([name, value]) => `${name}="${escape(value)}"`).join(' ')
    }/>`
  ).join('') +
  `</svg>`

const link = (href, label, current = false) =>
  `<a href="${escape(href)}"${current ? ' aria-current="page"' : ''}>${escape(label)}</a>`

const bar = (route, version) =>
  `<header class="bar">` +
  `<a class="brand" href="/" aria-label="imp - home"><img src="/mark-dark.svg" alt="">` +
  `<span>imp</span></a>` +
  `<nav aria-label="Sections"><ul class="links">` +
  SECTIONS.map((section) =>
    `<li>${link(section.href, section.label, section.isCurrent(route))}</li>`
  ).join('') +
  `</ul></nav>` +
  `<div class="end">` +
  `<button class="scheme" type="button" aria-label="Switch the theme">` +
  `${svgIcon('sun', luSun)}${svgIcon('moon', luMoon)}</button>` +
  `<span class="version">v${escape(version)}</span>` +
  `<div class="bars" aria-hidden="true"><div class="main-1"></div>` +
  `<div class="main-2"></div><div class="main-3"></div></div>` +
  `</div></header>`

const corner = () =>
  `<div class="corner" aria-hidden="true"><div class="geometry"><div class="grid"></div>` +
  GEOMETRY_SQUARES.map(({ tone, column, row, span = 1 }) =>
    `<div class="square ${tone}" style="--column: ${column}; --row: ${row}; --span: ${span}"></div>`
  ).join('') +
  `</div></div>`

const docsNav = (pages, currentSlug) =>
  `<nav aria-label="Documentation pages"><ul class="pages">` +
  pages.map((page) =>
    `<li>${link(`/docs/${page.slug}`, page.label, page.slug === currentSlug)}</li>`
  ).join('') +
  `</ul></nav>`

const docsIndex = (pages) =>
  `<ul>` +
  pages.map((page) =>
    `<li>${link(`/docs/${page.slug}`, page.label)} - ${escape(page.description)}</li>`
  ).join('') +
  `</ul>`

const pagesOf = ({ docs, overview }) => [
  {
    route: '',
    title: 'imp - the complete UI toolkit',
    description: overview.description,
    main: `<article class="overview md">${overview.html}</article>`,
    scripts: ['/overview.js'],
  },
  {
    route: 'components',
    title: 'Components - imp',
    description:
      'Every standard component of imp, rendered live, with its scenarios and its skill.',
    main: `<imp-preview></imp-preview>`,
    scripts: ['/gallery/imp-preview.js'],
  },
  {
    route: 'docs',
    title: 'Docs - imp',
    description: 'The documentation of imp: the CLI, rendering, components, state, routing, ' +
      'theming, testing and more.',
    main: `<div class="docs">${docsNav(docs, null)}<article class="paper md"><h1>Docs</h1>${
      docsIndex(docs)
    }</article></div>`,
  },
  ...docs.map((page) => ({
    route: `docs/${page.slug}`,
    title: `${page.label} - imp`,
    description: page.description,
    main: `<div class="docs">${docsNav(docs, page.slug)}<article class="paper md">${page.html}` +
      `</article></div>`,
  })),
]

const documentOf = (page, version) => {
  const url = ORIGIN === null ? null : `${ORIGIN}/${page.route}`
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    ...(url === null
      ? []
      : [`<link rel="canonical" href="${url}">`, `<meta property="og:url" content="${url}">`]),
    `<link rel="icon" href="/favicon.ico">`,
    `<link rel="preload" href="/fonts/ibm-plex-sans.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="/fonts/fonts.css">`,
    `<link rel="stylesheet" href="/site.css">`,
    earlyScript(),
  ]
  const scripts = ['/site.js', ...(page.scripts ?? [])]
  return `<!doctype html>
<html lang="en">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    ${bar(page.route, version)}
    <div class="canvas">${corner()}<main>${page.main}</main></div>
    ${scripts.map((src) => `<script type="module" src="${src}"></script>`).join('\n    ')}
  </body>
</html>
`
}

const writeSitemap = async (pages) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((page) => `  <url><loc>${ORIGIN}/${page.route}</loc></url>`).join('\n') +
    `\n</urlset>\n`
  await Deno.writeTextFile(join(DIST, 'sitemap.xml'), sitemap)
  await Deno.writeTextFile(
    join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
  )
}

await Deno.remove(DIST, { recursive: true }).catch(() => {})
await Deno.mkdir(DIST, { recursive: true })
const version = await readVersion()
const pages = pagesOf({
  docs: await renderDocs(),
  overview: await renderOverview(),
})
for (const page of pages) {
  await Deno.mkdir(join(DIST, page.route), { recursive: true })
  await Deno.writeTextFile(join(DIST, page.route, 'index.html'), documentOf(page, version))
}
await Deno.writeTextFile(join(DIST, 'site.css'), stylesheet())
await Deno.writeTextFile(join(DIST, 'site.js'), clientScript())
await Deno.writeTextFile(join(DIST, 'overview.js'), overviewScript())
for (const script of INSTALL_SCRIPTS) await Deno.copyFile(join(ROOT, script), join(DIST, script))
for (const [from, to] of COPIES) await Deno.copyFile(join(ROOT, from), join(DIST, to))
for (const [name, scheme] of MARKS) await Deno.writeTextFile(join(DIST, name), impMarkSvg(scheme))
await Deno.mkdir(join(DIST, 'fonts'))
for await (const { name } of Deno.readDir(FONTS)) {
  await Deno.copyFile(join(FONTS, name), join(DIST, 'fonts', name))
}
if (ORIGIN !== null) await writeSitemap(pages)
const galleryCode = await runImp(
  ['preview', '--output', join(DIST, 'gallery')],
  join(ROOT, 'lib', 'src'),
)
if (galleryCode !== 0) Deno.exit(galleryCode)
console.log(
  `site: ${pages.length} pages written into site/dist/` +
    (ORIGIN === null
      ? ' (set IMP_SITE_URL for canonical links and a sitemap)'
      : `, with a sitemap for ${ORIGIN}`),
)
