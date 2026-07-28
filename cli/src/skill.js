import { basename, dirname, join, relative, resolve } from '@std/path'
import { VERSION } from './version.js'
import { collectFiles } from './walk.js'

const DOCS = new URL('../../docs/', import.meta.url)
const LIBRARY = new URL('../../lib/src/', import.meta.url)

export const SKILL_SUFFIX = '.skill.md'

const GROUPS = [
  { id: 'app', title: 'WRITING AN APP' },
  { id: 'toolkit', title: 'WORKING IN AN IMP PROJECT' },
  {
    id: 'components',
    title: "STANDARD COMPONENTS — imported from 'imp/std' · read: imp skill std/button",
  },
]

const PROJECT_TITLE =
  'THIS PROJECT — components with a skill file · read: imp skill ./path/to/component.js'

const NO_PROJECT_SKILLS =
  "  (none yet — write 'counter.skill.md' next to a component and it is listed here)"

export const SKILLS = [
  {
    name: 'imports',
    doc: 'imports.md',
    group: 'app',
    aliases: ['imp', 'specifiers'],
    summary: 'every bare specifier imp resolves, and what each one exports',
  },
  {
    name: 'rendering',
    doc: 'rendering.md',
    group: 'app',
    aliases: ['html', 'imp/html', 'elements'],
    summary: 'element factories, props objects, children, and mount',
  },
  {
    name: 'components',
    doc: 'components.md',
    group: 'app',
    aliases: ['component'],
    summary: 'custom elements with an onMount lifecycle: instance, styles, cleanup',
  },
  {
    name: 'state',
    doc: 'state.md',
    group: 'app',
    aliases: ['imp/state'],
    summary: 'named reactive state shared down the tree and bound straight to the DOM',
  },
  {
    name: 'routing',
    doc: 'routing.md',
    group: 'app',
    aliases: ['router', 'imp/router'],
    summary: 'client-side routes as one plain-data table, with lazily loaded sections',
  },
  {
    name: 'std',
    doc: 'std-components.md',
    group: 'app',
    aliases: ['imp/std', 'std-components', 'imp/std/display'],
    summary: 'the built-in component library: button, heading, text, link, emptyState',
  },
  {
    name: 'theming',
    doc: 'theming.md',
    group: 'app',
    aliases: ['theme', 'imp/theme', 'tokens'],
    summary: 'themes as plain token modules, applied at the entry point and swappable',
  },
  {
    name: 'i18n',
    doc: 'i18n.md',
    group: 'app',
    aliases: ['imp/i18n', 'translations'],
    summary: 't() lookups, per-language messages, and the lang attribute that drives them',
  },
  {
    name: 'logging',
    doc: 'logging.md',
    group: 'app',
    aliases: ['log', 'imp/log', 'logger'],
    summary: 'the built-in logger and the per-environment log level',
  },
  {
    name: 'cli',
    doc: 'cli.md',
    group: 'toolkit',
    aliases: ['commands', 'config', 'imp.json', 'start', 'build', 'preview'],
    summary: 'every command, imp.json configuration, the dev server and the production build',
  },
  {
    name: 'testing',
    doc: 'testing.md',
    group: 'toolkit',
    aliases: ['test', 'imp/test'],
    summary: 'unit tests in-process and e2e specs against a real browser',
  },
  {
    name: 'dependencies',
    doc: 'dependencies.md',
    group: 'toolkit',
    aliases: ['deps', 'install', 'uninstall'],
    summary: 'vendoring packages into dependencies/ and importing them',
  },
  {
    name: 'lint',
    doc: 'lint.md',
    group: 'toolkit',
    aliases: ['rules'],
    summary: 'the imp lint rules, what each one prevents, and how to apply fixes',
  },
  {
    name: 'fmt',
    doc: 'fmt.md',
    group: 'toolkit',
    aliases: ['format', 'formatting'],
    summary: 'formatting every file type in the project with one command',
  },
]

export const COMPONENT_SKILLS = [
  { name: 'std/button', file: 'std/general/button.skill.md' },
  { name: 'std/heading', file: 'std/general/heading.skill.md' },
  { name: 'std/text', file: 'std/general/text.skill.md' },
  { name: 'std/link', file: 'std/general/link.skill.md' },
  { name: 'std/emptyState', file: 'std/display/empty_state.skill.md' },
]

const componentSubjects = COMPONENT_SKILLS.map((component) => {
  const exportName = component.name.slice('std/'.length)
  return {
    ...component,
    kind: 'component',
    group: 'components',
    url: new URL(component.file, LIBRARY),
    aliases: [exportName, `imp/${component.name}`],
  }
})

const docSubjects = SKILLS.map((skill) => ({
  ...skill,
  kind: 'doc',
  url: new URL(skill.doc, DOCS),
}))

const SUBJECTS = [...docSubjects, ...componentSubjects]

const normalize = (subject) =>
  subject.trim().toLowerCase().replace(/^\.?\//, '').replace(/\.md$/, '')

const byName = new Map()
for (const subject of SUBJECTS) {
  for (const name of [subject.name, ...subject.aliases]) byName.set(normalize(name), subject)
}

const nameByDoc = new Map(SKILLS.map((skill) => [skill.doc, skill.name]))

export const findSkill = (subject) => byName.get(normalize(subject)) ?? null

const DOC_LINK = /\[([^\]]+)\]\(([\w-]+)\.md(?:#[^)]*)?\)/g
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

function retargetLinks(text) {
  const related = new Set()
  const original = text.split('\n')
  const fenced = fencedLines(original)
  const lines = original.map((line, index) => {
    if (fenced[index]) return line
    return line.replaceAll(DOC_LINK, (match, label, file) => {
      const name = nameByDoc.get(`${file}.md`)
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
    .map((name) => `imp skill ${name}`).join(' · ')
  const footer = relatedLine ? `\n\nRelated: ${relatedLine}` : ''
  if (subject.kind === 'component') return `${retargeted}${footer}`
  const banner = `imp skill: ${subject.name} — ${subject.summary} (imp ${VERSION})`
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
      `no skill for ${display} — describe the component in ${basename(skillFile)} next to it`,
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

const INTRO = `imp skills — the usage manuals imp ships for the agent writing the code

imp is a buildless UI toolkit: your ES modules run in the browser exactly as written — no
compile step, no JSX, no bundler in development. Everything an app uses arrives through a
bare specifier imp resolves ('imp', 'imp/html', 'imp/state', …), and the same imp binary
serves, tests, lints, formats and builds the project.

Read one in full — no flags, the text goes to stdout:

  imp skill state                  a subject listed below (several at once is fine)
  imp skill std/button             a standard component
  imp skill ./src/counter.js       a component of this project, by path to its module
`

const OUTRO =
  `A component documents itself in a 'counter.skill.md' file next to it — write one for every
component you build, and an agent can learn it the same way it learns imp. 'imp help' lists
every command; run 'imp lint' and 'imp fmt' when you are done editing.`

const section = (title, entries, width) => {
  const lines = entries.map(({ name, summary }) => `  ${name.padEnd(width)}${summary}`)
  return `${title}\n${lines.join('\n')}`
}

export async function skillIndex({ root = null } = {}) {
  const listed = []
  for (const subject of SUBJECTS) {
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

function unknownSubject(subject) {
  const names = SUBJECTS.map(({ name }) => name).join(', ')
  return new Error(
    `unknown skill '${subject}' — run 'imp skill' for the index · subjects: ${names} · ` +
      'for a component of this project pass its path: imp skill ./path/to/component.js',
  )
}

async function renderRequested(subject) {
  const known = findSkill(subject)
  if (known) return await renderSkill(known)
  if (!looksLikeFile(subject)) throw unknownSubject(subject)
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
