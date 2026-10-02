import { join } from '@std/path'
import { scanGroupsModule } from '../src/preview-source.js'
import { findSkill, skillIndex, SKILLS, standardComponentSubjects } from '../src/skill.js'
import { IMP_MODULE_EXPORTS } from '../src/lint-rules.js'
import { IMP_MODULES } from '../src/specifiers.js'
import { check, fixture, normalize, REPO_ROOT, runImp } from './helpers.js'

Deno.test('imp skill', async (t) => {
  await t.step('every skills page is registered as a subject', async () => {
    const pages = []
    for await (const entry of Deno.readDir(join(REPO_ROOT, 'skills'))) {
      if (entry.isFile && entry.name.endsWith('.md')) pages.push(entry.name)
    }
    const registered = SKILLS.map((skill) => `${skill.name}.md`)
    for (const page of pages) {
      check(
        registered.includes(page),
        `skills/${page} has no subject in cli/src/skill.js - a page is named after its subject`,
      )
    }
    for (const file of registered) {
      check(pages.includes(file), `subject points at a missing skills/${file}`)
    }
  })

  await t.step('every subject prints its manual out of the binary', async () => {
    for (const skill of SKILLS) {
      const { code, stdout, stderr } = await runImp(['skill', skill.name])
      check(code === 0, `imp skill ${skill.name} exited ${code}: ${stderr}`)
      check(stderr === '', `imp skill ${skill.name} wrote to stderr: ${stderr}`)
      check(
        stdout.startsWith(`imp skill: ${skill.name} - ${skill.summary}`),
        `imp skill ${skill.name} is missing its banner`,
      )
      check(stdout.split('\n').length > 20, `imp skill ${skill.name} printed no manual`)
      const danglingLink = stdout.match(/\]\([\w-]+\.md[^)]*\)/)
      check(
        danglingLink === null,
        `imp skill ${skill.name} still links to a markdown file: ${danglingLink?.[0]}`,
      )
    }
  })

  await t.step('every std component is derived from the barrels with a skill file', async () => {
    const derived = await standardComponentSubjects()
    const exported = Object.entries(IMP_MODULE_EXPORTS)
      .filter(([specifier]) => specifier.startsWith('imp/std'))
      .flatMap(([, module]) => Object.keys(module))
    check(exported.length > 0, 'no std components found in the barrels')
    for (const name of exported) {
      const subject = derived.find((component) => component.name === `std/${name}`)
      check(subject !== undefined, `std/${name} is exported by imp/std but was not derived`)
      const exists = await Deno.stat(subject.url).then(() => true).catch(() => false)
      check(exists, `missing ${subject.url} - every std component ships a skill file`)
    }
    for (const { name } of derived) {
      const exportName = name.slice('std/'.length)
      check(
        exported.includes(exportName),
        `${name} was derived but imp/std exports no ${exportName}`,
      )
    }
  })

  await t.step(
    'a std folder is one group: its import, its preview group and its previews',
    async () => {
      const stdRoot = new URL('../../lib/src/std/', import.meta.url)
      const groupKeys = scanGroupsModule(
        await Deno.readTextFile(new URL('preview-groups.js', stdRoot)),
      )
      const folders = []
      for await (const entry of Deno.readDir(stdRoot)) {
        if (entry.isDirectory && entry.name !== 'shared' && !entry.name.startsWith('.')) {
          folders.push(entry.name)
        }
      }
      for (const key of groupKeys.keys()) {
        check(folders.includes(key), `preview group '${key}' has no lib/src/std/${key} folder`)
      }
      for (const folder of folders) {
        check(groupKeys.has(folder), `lib/src/std/${folder} has no preview group named '${folder}'`)
        const specifier = folder === 'general' ? 'imp/std' : `imp/std/${folder}`
        const barrel = IMP_MODULES[specifier]
        check(barrel !== undefined, `${specifier} is not a registered barrel`)
        const barrelSource = await Deno.readTextFile(new URL(`../${barrel}`, stdRoot))
        check(
          barrel === `std/${folder}/index.js` || barrelSource.includes(`'./${folder}/index.js'`),
          `${specifier} does not export lib/src/std/${folder}`,
        )
        for await (const file of Deno.readDir(new URL(`${folder}/`, stdRoot))) {
          if (!file.name.endsWith('.preview.js')) continue
          const source = await Deno.readTextFile(new URL(`${folder}/${file.name}`, stdRoot))
          const declared = source.match(/export const group = groups\.(\w+)/)?.[1]
          check(
            declared === folder,
            `lib/src/std/${folder}/${file.name} names group '${declared}', not '${folder}'`,
          )
        }
      }
    },
  )

  await t.step('a std component prints its skill file verbatim', async () => {
    for (const component of await standardComponentSubjects()) {
      const source = normalize((await Deno.readTextFile(component.url)).trimEnd())
      const { code, stdout } = await runImp(['skill', component.name])
      check(code === 0, `imp skill ${component.name} exited ${code}`)
      check(
        stdout.trimEnd() === source,
        `imp skill ${component.name} did not print ${component.url}`,
      )
    }
  })

  await t.step('subjects resolve by alias, specifier and file name', async () => {
    const resolves = async (subject) => (await findSkill(subject))?.name ?? null
    for (const skill of SKILLS) {
      for (const alias of [skill.name, ...skill.aliases]) {
        check(await resolves(alias) === skill.name, `'${alias}' does not resolve to ${skill.name}`)
      }
    }
    check(await resolves('imp/State') === 'state', 'subject lookup is not case-insensitive')
    check(await resolves('state.md') === 'state', 'a docs file name does not resolve')
    check(await resolves('button') === 'std/button', "'button' does not resolve to std/button")
    check(
      await resolves('imp/std/emptyState') === 'std/emptyState',
      'an imp/std specifier does not resolve to its component',
    )
    check(await resolves('bogus') === null, 'an unknown subject resolved to something')
  })

  await t.step('the index lists every subject once', async () => {
    const index = await skillIndex()
    for (const skill of [...SKILLS, ...await standardComponentSubjects()]) {
      const lines = index.split('\n').filter((line) => line.startsWith(`  ${skill.name} `))
      check(lines.length === 1, `${skill.name} appears ${lines.length} times in the index`)
    }
  })

  await t.step('the index lists the components of the project it runs in', async () => {
    const { stdout } = await runImp(['skill'], fixture('skill-project'))
    check(stdout.includes('THIS PROJECT'), 'the index has no project section')
    check(
      /\n {2}\.\/counter\.js\s+counter - a self-contained/.test(stdout),
      'the project component is missing from the index',
    )
    check(
      stdout.includes('read: imp skill ./path/to/component.js'),
      'the index does not say how to read a component by path',
    )
    check(
      stdout.includes('imp skill std/button'),
      'the index does not say how to read a standard component',
    )
  })

  await t.step('a project with no skill files still explains the convention', async () => {
    const { stdout } = await runImp(['skill'], fixture('basic'))
    check(stdout.includes('THIS PROJECT'), 'the project section is missing when nothing is found')
    check(stdout.includes('counter.skill.md'), 'the empty project section names no file to write')
  })
})
