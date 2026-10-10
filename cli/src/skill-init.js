import { dirname, join, resolve } from '@std/path'
import { bold, dim, green } from './colors.js'

const SKILL_NAME = 'imp'
const SKILL_TARGETS = [
  { dir: '.agents/skills', readBy: 'Codex, Cursor' },
  { dir: '.claude/skills', readBy: 'Claude Code, Cursor' },
]

export const agentSkill = `---
name: ${SKILL_NAME}
description: Write and change apps and components built with imp, the buildless UI toolkit. Use when the project has an imp.json file, or when asked to build pages, components, routes, state, styles or tests with imp.
---

# imp

imp is a buildless UI toolkit. Its call shapes differ from React, Vue and other
frameworks in ways that look correct either way. Do not write imp code from
memory. Read the manuals that ship with the imp version the project runs.

## Workflow

1. Run \`imp skill\` before you write code. It prints the index of every manual.
   In a new project from \`imp init\`, follow \`imp skill init\` first: keep the
   font it picked and give the app a theme of its own.
2. Run \`imp skill <subject>\` for each part you need, such as
   \`imp skill state routing\` or \`imp skill std/button\`.
3. For a component of the project, run \`imp skill ./path/to/component.js\`.
   Write a \`<name>.skill.md\` next to every component you build.
4. When the person mentions a review, a comment or an element they marked in
   the browser, run \`imp review\` first.
5. Run \`imp logs\` to read the browser console, the errors and the network of
   the dev server.
6. When you are done, run \`imp lint\`, \`imp fmt\` and the tests
   (\`imp test --unit\`, \`imp test --e2e\`).

## Rules

- Configuration lives in \`imp.json\`. Add no bundler and no JSX.
- Add a package with \`imp install <package>\`. It vendors the package into
  \`dependencies/\`.
`

const exists = async (path) => {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

const homeDirectory = () => Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE')

export async function findSkillRoot(start = Deno.cwd(), home = homeDirectory()) {
  const homeDir = home ? resolve(home) : null
  let dir = resolve(start)
  while (true) {
    if (await exists(join(dir, '.git'))) return { dir, reason: 'git root', global: false }
    const parent = dirname(dir)
    if (dir === homeDir || parent === dir) break
    dir = parent
  }
  if (!homeDir) throw new Error('not in a git repository and the home folder is unknown - set HOME')
  return { dir: homeDir, reason: 'not in a git repository', global: true }
}

export async function installAgentSkill(root) {
  const files = SKILL_TARGETS.map((target) => ({
    ...target,
    path: `${target.dir}/${SKILL_NAME}/SKILL.md`,
  }))
  for (const { path } of files) {
    const file = join(root.dir, path)
    if (await exists(file)) {
      throw new Error(`${file} already exists - delete it to write the skill again`)
    }
  }
  for (const { path } of files) {
    const file = join(root.dir, path)
    await Deno.mkdir(dirname(file), { recursive: true })
    await Deno.writeTextFile(file, agentSkill)
  }
  return files
}

export async function initAgentSkill({ cwd = Deno.cwd(), home = homeDirectory() } = {}) {
  const root = await findSkillRoot(cwd, home)
  const files = await installAgentSkill(root)
  const created = root.global ? 'Created the imp skill for all projects' : 'Created the imp skill'
  console.log(`${green(created)} in ${root.dir} (${root.reason})\n`)
  const width = Math.max(...files.map((file) => file.path.length))
  for (const { path, readBy } of files) {
    console.log(`  ${bold(path.padEnd(width))}  ${dim(readBy)}`)
  }
  console.log('\nTry: /imp add a settings page with a theme switch')
}
