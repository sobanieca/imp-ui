import { basename, dirname, join, relative, resolve } from '@std/path'
import { VERSION } from './version.js'
import { collectFiles } from './walk.js'
import { IMP_MODULES, isImpStdSpecifier } from './specifiers.js'

const SUBJECT_SKILLS = new URL('../../skills/', import.meta.url)
const LIBRARY = new URL('../../lib/src/', import.meta.url)

export const SKILL_SUFFIX = '.skill.md'

const GROUPS = [
  { id: 'app', title: 'WRITING AN APP' },
  { id: 'toolkit', title: 'WORKING IN AN IMP PROJECT' },
  {
    id: 'components',
    title: "STANDARD COMPONENTS - imported from 'imp/std' | read: imp skill std/button",
  },
]

const PROJECT_TITLE =
  'THIS PROJECT - components with a skill file | read: imp skill ./path/to/component.js'

const NO_PROJECT_SKILLS =
  "  (none yet - write 'counter.skill.md' next to a component and it is listed here)"

export const SKILLS = [
  {
    name: 'imports',
    group: 'app',
    aliases: ['imp', 'specifiers'],
    summary: 'every bare specifier imp resolves, and what each one exports',
  },
  {
    name: 'rendering',
    group: 'app',
    aliases: ['html', 'imp/html', 'elements'],
    summary: 'element factories, props objects, children, and mount',
  },
  {
    name: 'components',
    group: 'app',
    aliases: ['component'],
    summary: 'custom elements with a setup lifecycle: instance, styles, cleanup',
  },
  {
    name: 'custom-components',
    group: 'app',
    aliases: ['custom', 'guidelines', 'component-guidelines', 'own-components'],
    summary:
      'the theme, direction, wording and accessibility rules a component of yours must follow',
  },
  {
    name: 'state',
    group: 'app',
    aliases: ['imp/state'],
    summary: 'named reactive state shared down the tree and bound straight to the DOM',
  },
  {
    name: 'http',
    group: 'app',
    aliases: ['imp/http', 'fetch', 'api', 'http-client'],
    summary: 'the configured HTTP client a component owns, with retries and request state',
  },
  {
    name: 'routing',
    group: 'app',
    aliases: ['router', 'imp/router', 'map', 'app-map', 'appmap', 'app-map.js'],
    summary: 'one application map drives the routes, the nav of the shell and the trail',
  },
  {
    name: 'std',
    group: 'app',
    aliases: [
      'imp/std',
      'standard-components',
      'imp/std/layout',
      'imp/std/display',
      'imp/std/inputs',
      'imp/std/feedback',
      'imp/std/data',
      'imp/std/shell',
    ],
    summary: 'the built-in component library: text, layout, forms, navigation and empty states',
  },
  {
    name: 'icons',
    group: 'app',
    aliases: ['imp/icons', 'lucide'],
    summary: 'the Lucide icon set as tree-shaken exports, drawn by icon',
  },
  {
    name: 'theming',
    group: 'app',
    aliases: ['theme', 'imp/theme', 'tokens'],
    summary: 'themes as plain token modules, applied at the entry point and swappable',
  },
  {
    name: 'i18n',
    group: 'app',
    aliases: ['imp/i18n', 'translations'],
    summary: 't() lookups, per-language messages, and the lang attribute that drives them',
  },
  {
    name: 'logging',
    group: 'app',
    aliases: ['log', 'imp/log', 'logger'],
    summary: 'the built-in logger and the per-environment log level',
  },
  {
    name: 'analytics',
    group: 'app',
    aliases: ['imp/analytics', 'zone', 'zones', 'track', 'onanalytics', 'tracking', 'metrics'],
    summary: 'page views, zones and outcomes as plain records, sent to a sink of the app',
  },
  {
    name: 'feature-flags',
    group: 'app',
    aliases: ['flag', 'flags', 'feature-flag', 'toggles'],
    summary: 'flag() gates a feature per environment and imp build folds the branch away',
  },
  {
    name: 'cli',
    group: 'toolkit',
    aliases: ['commands', 'help'],
    summary: 'every command, and which skill covers it',
  },
  {
    name: 'init',
    group: 'toolkit',
    aliases: ['scaffold', 'new', 'create', 'starter'],
    summary: 'scaffolding a runnable project: what imp init writes and what it refuses',
  },
  {
    name: 'config',
    group: 'toolkit',
    aliases: ['imp.json', 'imp.jsonc', 'environments', 'env'],
    summary: 'the imp.json file key by key, and the --env environment files',
  },
  {
    name: 'start',
    group: 'toolkit',
    aliases: ['serve', 'dev', 'dev-server', 'logs', 'dev.log'],
    summary: 'the dev server: injected imports, live reload and the session log of imp logs',
  },
  {
    name: 'build',
    group: 'toolkit',
    aliases: ['bundle', 'pwa', 'dist', 'targetimphost', 'public', 'assets'],
    summary: 'the production build, JS entries for publishing, and the offline PWA output',
  },
  {
    name: 'mocks',
    group: 'toolkit',
    aliases: ['mock', 'mock.js', 'fixtures', 'backend'],
    summary: "answering the app's requests from *.mock.js files instead of the network",
  },
  {
    name: 'service-worker',
    group: 'toolkit',
    aliases: ['imp/service-worker', 'sw', 'sw.js', 'startdevmode', 'dev-mode'],
    summary: 'a service worker of your own, bundled by imp, with dev mode from startDevMode()',
  },
  {
    name: 'preview',
    group: 'toolkit',
    aliases: ['previews', 'preview.js', 'imp/preview', 'scenarios'],
    summary: 'rendering components in isolation from a *.preview.js file',
  },
  {
    name: 'review',
    group: 'toolkit',
    aliases: ['reviews', 'feedback', 'comments'],
    summary:
      'run it when the person mentions a review, a comment or an element they marked in the browser',
  },
  {
    name: 'testing',
    group: 'toolkit',
    aliases: ['test', 'imp/test'],
    summary: 'unit tests in-process and e2e specs against a real browser',
  },
  {
    name: 'dependencies',
    group: 'toolkit',
    aliases: ['deps', 'install', 'uninstall'],
    summary: 'vendoring packages into dependencies/ and importing them',
  },
  {
    name: 'lint',
    group: 'toolkit',
    aliases: ['rules'],
    summary: 'the imp lint rules, what each one prevents, and how to apply fixes',
  },
  {
    name: 'fmt',
    group: 'toolkit',
    aliases: ['format', 'formatting'],
    summary: 'formatting every file type in the project with one command',
  },
  {
    name: 'resize',
    group: 'toolkit',
    aliases: ['image', 'images'],
    summary: 'downscaling an oversized PNG or JPEG asset in place',
  },
  {
    name: 'skill',
    group: 'toolkit',
    aliases: ['skills', 'skill.md'],
    summary: 'reading these manuals, and writing a *.skill.md for a component',
  },
  {
    name: 'update',
    group: 'toolkit',
    aliases: ['version', 'pin', 'prune', 'licenses'],
    summary: 'pinning the imp version, pruning cached ones, and the license notices',
  },
]

const STD_BARRELS = Object.entries(IMP_MODULES)
  .filter(([specifier]) => isImpStdSpecifier(specifier))
  .map(([, module]) => new URL(module, LIBRARY))

const BARREL_EXPORT = /export\s*(?:(\*)|\{\s*(\w+)\s*\})\s*from\s*'([^']+)'/g

async function barrelComponents(barrel) {
  const source = await Deno.readTextFile(barrel)
  const components = []
  for (const [, star, name, module] of source.matchAll(BARREL_EXPORT)) {
    if (star) components.push(...await barrelComponents(new URL(module, barrel)))
    else components.push({ name, url: new URL(skillFileFor(module), barrel) })
  }
  return components
}

export async function standardComponentSubjects() {
  const subjects = []
  for (const barrel of STD_BARRELS) {
    for (const { name, url } of await barrelComponents(barrel)) {
      subjects.push({
        name: `std/${name}`,
        kind: 'component',
        group: 'components',
        url,
        aliases: [name, `imp/std/${name}`],
      })
    }
  }
  return subjects
}

const subjectSkills = SKILLS.map((skill) => ({
  ...skill,
  kind: 'subject',
  file: `${skill.name}.md`,
  url: new URL(`${skill.name}.md`, SUBJECT_SKILLS),
}))

const loadSubjects = async () => [...subjectSkills, ...await standardComponentSubjects()]

let subjects = null

const allSubjects = () => (subjects ??= loadSubjects())

const normalize = (subject) =>
  subject.trim().toLowerCase().replace(/^\.?\//, '').replace(/\.md$/, '')

const nameByFile = new Map(subjectSkills.map((skill) => [skill.file, skill.name]))

export async function findSkill(subject) {
  const wanted = normalize(subject)
  return (await allSubjects()).find((candidate) =>
    [candidate.name, ...candidate.aliases].some((name) => normalize(name) === wanted)
  ) ?? null
}

const SUBJECT_LINK = /\[([^\]]+)\]\(([\w-]+)\.md(?:#[^)]*)?\)/g
const FENCE = /^\s*(`{3,})(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const SEPARATOR_CELL = /^:?-+:?$/

const cellsOf = (row) => row.trim().slice(1, -1).split('|').map((cell) => cell.trim())

function alignedTable(rows) {
  const table = rows.map(cellsOf)
  const columns = Math.max(...table.map((cells) => cells.length))
  const widths = []
  for (let index = 0; index < columns; index++) {
    widths.push(Math.max(...table.map((cells) => {
      const cell = cells[index] ?? ''
      return SEPARATOR_CELL.test(cell) ? 3 : cell.length
    })))
  }
  return table.map((cells) => {
    const padded = widths.map((width, index) => {
      const cell = cells[index] ?? ''
      return SEPARATOR_CELL.test(cell) ? cell[0] + '-'.repeat(width - 1) : cell.padEnd(width)
    })
    return `| ${padded.join(' | ')} |`.replace(/\s+$/, '')
  })
}

function fencedLines(lines) {
  const fenced = []
  let openWidth = 0
  for (const line of lines) {
    const fence = line.match(FENCE)
    if (!fence) {
      fenced.push(openWidth > 0)
      continue
    }
    const width = fence[1].length
    if (!openWidth) openWidth = width
    else if (width >= openWidth && fence[2].trim() === '') openWidth = 0
    fenced.push(true)
  }
  return fenced
}

export function retargetLinks(text) {
  const related = new Set()
  const original = text.split('\n')
  const fenced = fencedLines(original)
  const lines = original.map((line, index) => {
    if (fenced[index]) return line
    return line.replaceAll(SUBJECT_LINK, (match, label, file) => {
      const name = nameByFile.get(`${file}.md`)
      if (!name) return match
      related.add(name)
      return `${label} (imp skill ${name})`
    })
  })
  realignChangedTables(lines, original, fenced)
  return { retargeted: lines.join('\n'), related: [...related] }
}

function realignChangedTables(lines, original, fenced) {
  let start = -1
  const flush = (end) => {
    if (start === -1) return
    const rows = lines.slice(start, end)
    if (rows.some((row, index) => row !== original[start + index])) {
      alignedTable(rows).forEach((row, index) => lines[start + index] = row)
    }
    start = -1
  }
  for (let index = 0; index < lines.length; index++) {
    if (!fenced[index] && TABLE_ROW.test(lines[index])) {
      if (start === -1) start = index
      continue
    }
    flush(index)
  }
  flush(lines.length)
}

const firstLine = (text) => text.trimStart().split('\n')[0].replace(/^#+\s*/, '').trim()

const readSkillText = async (source) => (await Deno.readTextFile(source)).trimEnd()

async function summaryOf(subject) {
  return subject.summary ?? firstLine(await readSkillText(subject.url))
}

async function renderSkill(subject) {
  const { retargeted, related } = retargetLinks(await readSkillText(subject.url))
  const relatedLine = related.filter((name) => name !== subject.name)
    .map((name) => `imp skill ${name}`).join(' | ')
  const footer = relatedLine ? `\n\nRelated: ${relatedLine}` : ''
  if (subject.kind === 'component') return `${retargeted}${footer}`
  const banner = `imp skill: ${subject.name} - ${subject.summary} (imp ${VERSION})`
  return `${banner}\n\n${retargeted}${footer}`
}

export const skillFileFor = (path) =>
  path.endsWith(SKILL_SUFFIX)
    ? path
    : join(dirname(path), basename(path).replace(/\.[^.]+$/, '') + SKILL_SUFFIX)

export async function readComponentSkill(path, display = path) {
  const skillFile = skillFileFor(path)
  try {
    return await readSkillText(skillFile)
  } catch {
    throw new Error(
      `no skill for ${display} - describe the component in ${basename(skillFile)} next to it`,
    )
  }
}

export async function projectSkills(root) {
  if (!root) return []
  const files = await collectFiles({ root, paths: [], extensions: new Set(['md']) })
    .catch(() => [])
  const skills = []
  for (const file of files) {
    if (!file.endsWith(SKILL_SUFFIX)) continue
    const module = file.slice(0, -SKILL_SUFFIX.length) + '.js'
    const hasModule = await Deno.stat(module).then(() => true).catch(() => false)
    const path = relative(root, hasModule ? module : file).replaceAll('\\', '/')
    skills.push({ name: `./${path}`, summary: firstLine(await Deno.readTextFile(file)) })
  }
  return skills
}

const INTRO = `imp skills - the usage manuals imp ships for the agent writing the code

imp is a buildless UI toolkit: your ES modules run in the browser exactly as written - no
compile step, no JSX, no bundler in development. Everything an app uses arrives through a
bare specifier imp resolves ('imp', 'imp/html', 'imp/state', ...), and the same imp binary
serves, tests, lints, formats and builds the project.

Read one in full - no flags, the text goes to stdout:

  imp skill state                  a subject listed below (several at once is fine)
  imp skill std/button             a standard component
  imp skill ./src/counter.js       a component of this project, by path to its module
`

const OUTRO =
  `A component documents itself in a 'counter.skill.md' file next to it - write one for every
component you build, and an agent can learn it the same way it learns imp. When the person
mentions a review, a comment they left, or an element they marked in the browser, run
'imp review' first: it tells you the page, the element and the state they mean. 'imp help'
lists every command; run 'imp lint' and 'imp fmt' when you are done editing.`

const section = (title, entries, width) => {
  const lines = entries.map(({ name, summary }) => `  ${name.padEnd(width)}${summary}`)
  return `${title}\n${lines.join('\n')}`
}

export async function skillIndex({ root = null } = {}) {
  const listed = []
  for (const subject of await allSubjects()) {
    listed.push({ ...subject, summary: await summaryOf(subject) })
  }
  const project = await projectSkills(root)
  const widthOf = (entries) => Math.max(...entries.map(({ name }) => name.length)) + 2
  const width = widthOf(listed)
  const sections = GROUPS.map(({ id, title }) =>
    section(title, listed.filter((subject) => subject.group === id), width)
  )
  sections.push(
    project.length
      ? section(PROJECT_TITLE, project, widthOf(project))
      : `${PROJECT_TITLE}\n${NO_PROJECT_SKILLS}`,
  )
  return `${INTRO}\n${sections.join('\n\n')}\n\n${OUTRO}`
}

const looksLikeFile = (subject) =>
  subject.endsWith(SKILL_SUFFIX) || subject.endsWith('.js') || subject.includes('/') ||
  subject.includes('\\')

async function unknownSubject(subject) {
  const names = (await allSubjects()).map(({ name }) => name).join(', ')
  return new Error(
    `unknown skill '${subject}' - run 'imp skill' for the index | subjects: ${names} | ` +
      'for a component of this project pass its path: imp skill ./path/to/component.js',
  )
}

async function renderRequested(subject) {
  const known = await findSkill(subject)
  if (known) return await renderSkill(known)
  if (!looksLikeFile(subject)) throw await unknownSubject(subject)
  return await readComponentSkill(resolve(subject), subject)
}

export async function printSkill({ subjects = [], root = null } = {}) {
  if (!subjects.length) {
    console.log(await skillIndex({ root }))
    return
  }
  const rendered = []
  for (const subject of subjects) rendered.push(await renderRequested(subject))
  console.log(rendered.join('\n\n'))
}
