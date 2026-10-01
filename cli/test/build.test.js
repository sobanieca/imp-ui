import { dirname, join, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { readHtml } from '../src/html-document.js'
import {
  check,
  commandTranscript,
  copyDirectory,
  fixture,
  listFiles,
  posixPath,
  ROOT,
  runImp,
  runServiceWorker,
  section,
  tempDir,
  workerReport,
} from './helpers.js'

Deno.test('imp build', async (t) => {
  const dir = await tempDir()
  await copyDirectory(fixture('build'), dir)

  const mask = (text) =>
    text
      .replaceAll(dir, '<tmp>')
      .replaceAll(dir.slice(1), '<tmp>')
      .replaceAll(posixPath(ROOT).slice(1), '<root>/')
      .replace(/-[A-Z0-9]{8}\b/g, '-<hash>')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const outputTree = async (outdir) => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, outdir), `${outdir}/`).catch(() => {})
    files.sort()
    return section('output files', files.join('\n'))
  }

  try {
    await t.step('build-app', async () => {
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const licenses = await Deno.readTextFile(join(dir, 'dist', 'LICENSES.txt'))
      const appMap = await Deno.readTextFile(join(dir, 'dist', 'app-map.txt'))
      const entry = html.match(/src="\/(chunks\/app-[A-Z0-9]{8}\.js)"/)[1]
      const { server, base } = serveFolder(() => join(dir, 'dist'))
      const probe = `const module = await import(${JSON.stringify(`${base}/${entry}`)})\n` +
        "console.log(`[bundled module: message='${module.message}', impLogLevel=${module.impLogLevel}, " +
        "lazy loadShout()='${await module.loadShout()}']`)"
      let usage
      try {
        const { stdout, stderr } = await new Deno.Command(Deno.execPath(), {
          args: ['eval', '--no-lock', probe],
          stdout: 'piped',
          stderr: 'piped',
        }).output()
        usage = new TextDecoder().decode(stdout).trim() || new TextDecoder().decode(stderr)
      } finally {
        await server.shutdown()
      }
      await assertSnapshot(
        'build-app',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${await outputTree(
            'dist',
          )}\n\n${section('dist/index.html', html)}\n\n${
            section('dist/LICENSES.txt', licenses)
          }\n\n${section('dist/app-map.txt', appMap)}\n\n${usage}\n`,
        ),
      )
    })

    await t.step('build-js-entry', async () => {
      const result = await runImp(['build', 'app.js', '--output', 'component'], dir)
      const module = await import(toFileUrl(join(dir, 'component', 'app.js')).href)
      const usage = `[bundled module: message='${module.message}', lazy loadShout()='${await module
        .loadShout()}']`
      await assertSnapshot(
        'build-js-entry',
        mask(
          `${
            commandTranscript('imp build app.js --output component  (cwd: <tmp>)', result)
          }\n${await outputTree('component')}\n\n${usage}\n`,
        ),
      )
    })

    await t.step('build-unreachable-chunks', async () => {
      const chunksOf = async (entry, source) => {
        await Deno.writeTextFile(join(dir, entry), source)
        const result = await runImp(['build', entry, '--output', 'chunks-probe'], dir)
        const chunks = join(dir, 'chunks-probe', 'chunks')
        const entries = await Array.fromAsync(Deno.readDir(chunks)).catch(() => [])
        const files = entries.map((file) => file.name.replace(/-[A-Z0-9]{8}\.js/, '-<hash>.js'))
        await Deno.remove(join(dir, entry))
        await Deno.remove(join(dir, 'chunks-probe'), { recursive: true })
        return `${entry}: exit ${result.code}, chunks: ${files.sort().join(', ') || 'none'}`
      }
      const report = [
        await chunksOf(
          'list-entry.js',
          "import { list } from 'imp/std/data'\n\nexport const render = () => list({ label: 'Rows' })\n",
        ),
        await chunksOf(
          'map-entry.js',
          "import { map } from 'imp/std/data'\n\nexport const render = () => map({ label: 'World' })\n",
        ),
      ]
      await assertSnapshot('build-unreachable-chunks', `${report.join('\n')}\n`)
    })

    await t.step('build-imp-subpath', async () => {
      const entry = join(dir, 'std-entry.js')
      await Deno.writeTextFile(
        entry,
        "import { mount } from 'imp'\nimport { button } from 'imp/std'\n\n" +
          "export const render = () => mount('#app', button('Save'))\n",
      )
      const resolved = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      const code = await Deno.readTextFile(join(dir, 'std', 'std-entry.js'))
      await Deno.writeTextFile(
        entry,
        "import { barChart } from 'imp/std/charts'\n\nexport const shell = barChart\n",
      )
      const unknown = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      await Deno.writeTextFile(
        entry,
        "import { expect } from 'imp/test'\n\nexport const check = expect\n",
      )
      const tooling = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      await Deno.remove(entry)
      await Deno.remove(join(dir, 'std'), { recursive: true })
      await assertSnapshot(
        'build-imp-subpath',
        mask(
          `${
            commandTranscript('imp build std-entry.js --output std  (cwd: <tmp>)', resolved)
          }\n[bundle defines the element: ${
            code.includes('imp-${') && code.includes('variant-')
          }]\n[bundle carries a development check: ${code.includes('__IMP_DEV__')}]\n\n${
            commandTranscript(
              'imp build std-entry.js --output std  (cwd: <tmp>, unknown subpath)',
              unknown,
            )
          }\n\n${
            commandTranscript(
              'imp build std-entry.js --output std  (cwd: <tmp>, tooling-only subpath)',
              tooling,
            )
          }\n`,
        ),
      )
    })

    const writeImpJson = (config) =>
      Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')

    await t.step('build-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: true,
      })
      const result = await runImp(['build', 'app.js', '--output', 'shared'], dir)
      const code = await Deno.readTextFile(join(dir, 'shared', 'app.js'))
      await assertSnapshot(
        'build-target-imp-host',
        mask(
          `${
            commandTranscript('imp build app.js --output shared  (cwd: <tmp>)', result)
          }\n${await outputTree('shared')}\n\n${section('shared/app.js', code)}\n`,
        ),
      )
    })

    await t.step('build-component-skill', async () => {
      const marker = 'WIDGETSKILLMARKER'
      const project = await tempDir()
      const write = (name, text) => Deno.writeTextFile(join(project, name), text)
      await write('eager.js', "export const eager = () => 'eager'\n")
      await write('eager.skill.md', `# eager - ${marker} a statically imported component\n`)
      await write('lazy.js', "export const lazy = () => 'lazy'\n")
      await write('lazy.skill.md', `# lazy - ${marker} a lazily imported component\n`)
      await write(
        'app.js',
        "import { eager } from './eager.js'\n\n" +
          "export const boot = async () => eager() + (await import('./lazy.js')).lazy()\n",
      )
      await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
      const componentOut = await tempDir()
      const component = await runImp(['build', 'eager.js', '--output', componentOut], project)
      const { impSkill } = await import(toFileUrl(join(componentOut, 'eager.js')).href)
      const app = await runImp(['build', '--output', 'app'], project)
      const appFiles = []
      const walkOutput = async (directory, prefix) => {
        for await (const entry of Deno.readDir(directory)) {
          const path = join(directory, entry.name)
          if (entry.isDirectory) await walkOutput(path, `${prefix}${entry.name}/`)
          else appFiles.push({ name: prefix + entry.name, text: await Deno.readTextFile(path) })
        }
      }
      await walkOutput(join(project, 'app'), '')
      appFiles.sort((one, other) => one.name.localeCompare(other.name))
      const carrying = appFiles.filter((file) => file.text.includes(marker)).map((file) =>
        file.name
      )
      const bundled = appFiles.filter((file) => file.name.endsWith('.js')).map((file) => file.name)
      await Deno.remove(project, { recursive: true })
      await Deno.remove(componentOut, { recursive: true })
      const maskOutdir = (text) => text.replace(/-> \.\.[/\\]\S+[/\\]/g, '-> <component-out>/')
      await assertSnapshot(
        'build-component-skill',
        maskOutdir(mask(
          `${
            commandTranscript(
              'imp build eager.js --output <component-out>  (cwd: <tmp>, component build)',
              component,
            )
          }\n${section('impSkill exported by the component bundle', String(impSkill))}\n\n${
            commandTranscript('imp build --output app  (cwd: <tmp>, app build)', app)
          }\n${
            section(
              'app bundles (eager imported statically, lazy dynamically)',
              bundled.join('\n'),
            )
          }\n\n[app files carrying skill text: ${carrying.join(', ') || 'none'}]\n` +
            `[skill files copied into the app output: ${
              appFiles.some((file) => file.name.endsWith('.skill.md'))
            }]\n`,
        )),
      )
    })

    await t.step('build-app-strips-existing-skills', async () => {
      const marker = 'PREBUILTSKILLMARKER'
      const project = await tempDir()
      const write = (name, text) => Deno.writeTextFile(join(project, name), text)
      await Deno.mkdir(join(project, 'dependencies', 'widget'), { recursive: true })
      await write(
        join('dependencies', 'widget', 'widget.js'),
        `var s="# widget - ${marker} a published component";var w=()=>"widget";` +
          'export{s as impSkill,w as widget};\n',
      )
      await write('imp.json', '{ "dependencies": { "widget": "npm:widget@1.0.0" } }\n')
      await write(
        'hand.js',
        `export const impSkill = "# hand - ${marker} written into the module by hand"\n` +
          "export const hand = () => 'hand'\n",
      )
      await write(
        'app.js',
        'export const boot = async () =>\n' +
          "  (await import('widget')).widget() + (await import('./hand.js')).hand()\n",
      )
      await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
      const result = await runImp(['build'], project)
      const chunks = []
      for await (const entry of Deno.readDir(join(project, 'dist', 'chunks'))) {
        if (entry.name.startsWith('app-')) continue
        chunks.push({
          name: entry.name,
          text: await Deno.readTextFile(join(project, 'dist', 'chunks', entry.name)),
        })
      }
      chunks.sort((one, other) => one.name.localeCompare(other.name))
      const carrying = chunks.filter((chunk) => chunk.text.includes(marker)).map((c) => c.name)
      const transcript = `${commandTranscript('imp build  (cwd: <tmp>, app build)', result)}\n` +
        `${
          section(
            'lazy chunks (a vendored pre-built component and a hand-written impSkill)',
            chunks.map((chunk) => chunk.text.trim()).join('\n'),
          )
        }\n\n[chunks carrying skill text: ${carrying.join(', ') || 'none'}]\n`
      await Deno.remove(project, { recursive: true })
      await assertSnapshot(
        'build-app-strips-existing-skills',
        mask(transcript).replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js'),
      )
    })

    await t.step('build-html-entry-ignores-target-imp-host', async () => {
      const result = await runImp(['build'], dir)
      await assertSnapshot(
        'build-html-entry-ignores-target-imp-host',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-invalid-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: 'yes',
      })
      const result = await runImp(['build', 'app.js'], dir)
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'build-invalid-target-imp-host',
        mask(commandTranscript('imp build app.js  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-missing-entry', async () => {
      const result = await runImp(['build', 'missing.html'], dir)
      await assertSnapshot(
        'build-missing-entry',
        mask(commandTranscript('imp build missing.html  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-entry-only-in-public', async () => {
      const entry = join(dir, 'index.html')
      const html = await Deno.readTextFile(entry)
      const moved = join(dir, 'public', 'index.html')
      await Deno.writeTextFile(moved, html)
      await Deno.remove(entry)
      const result = await runImp(['build'], dir)
      await Deno.writeTextFile(entry, html)
      await Deno.remove(moved)
      await assertSnapshot(
        'build-entry-only-in-public',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-output-contains-project', async () => {
      const result = await runImp(['build', '--output', '.'], dir)
      await assertSnapshot(
        'build-output-contains-project',
        mask(commandTranscript('imp build --output .  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-not-vendored', async () => {
      const result = await runImp(['build'], fixture('with-config'))
      await assertSnapshot(
        'build-not-vendored',
        mask(
          commandTranscript('imp build  (cwd: /test/fixtures/with-config)', result),
        ),
      )
    })

    await t.step('build-base-path', async () => {
      await Deno.mkdir(join(dir, 'env'), { recursive: true })
      await Deno.writeTextFile(
        join(dir, 'env', 'prod.json'),
        JSON.stringify({ IMP_BASEPATH: '/my-imp-app' }, null, 2) + '\n',
      )
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        environments: { default: 'env/prod.json' },
      })
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'build-base-path',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${await outputTree('dist')}` +
            `\n\n${section('dist/index.html', html)}\n`,
        ),
      )
    })

    await t.step('build-over-budget', async () => {
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' }, build: { maxSize: 2048 } })
      const result = await runImp(['build'], dir)
      const distExists = await Deno.stat(join(dir, 'dist')).then(() => true).catch(() => false)
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'build-over-budget',
        `${
          mask(commandTranscript('imp build  (cwd: <tmp>, build.maxSize 2048)', result))
            .replace(/the build is [\d.]+ k?B/, 'the build is <size>')
        }\n` +
          `[dist left behind: ${distExists}]\n`,
      )
    })

    await t.step('build-public-hashed-folder', async () => {
      const reserved = join(dir, 'public', 'chunks')
      await Deno.mkdir(reserved)
      await Deno.writeTextFile(join(reserved, 'old.js'), 'export const old = true\n')
      const result = await runImp(['build'], dir)
      await Deno.remove(reserved, { recursive: true })
      await assertSnapshot(
        'build-public-hashed-folder',
        mask(commandTranscript('imp build  (cwd: <tmp>, with public/chunks/)', result)),
      )
    })

    await t.step('build-public-collision', async () => {
      const collision = join(dir, 'public', 'LICENSES.txt')
      await Deno.writeTextFile(collision, 'a file of the app\n')
      const result = await runImp(['build'], dir)
      await Deno.remove(collision)
      await assertSnapshot(
        'build-public-collision',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build carries the notice of the QR code encoder only where qrCode is bundled', async () => {
  const project = await tempDir()
  const write = (name, text) => Deno.writeTextFile(join(project, name), text)
  const buildWith = async (component, output) => {
    await write(
      'app.js',
      `import { mount } from 'imp'\nimport { ${component.name} } from '${component.from}'\n\n` +
        `mount(document.body, ${component.call})\n`,
    )
    const result = await runImp(['build', '--output', output], project)
    check(result.code === 0, `imp build failed:\n${result.stdout}\n${result.stderr}`)
    return await Deno.readTextFile(join(project, output, 'LICENSES.txt'))
  }
  try {
    await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
    const drawing = await buildWith(
      { name: 'qrCode', from: 'imp/std/display', call: "qrCode({ value: 'https://imp.dev' })" },
      'drawing',
    )
    const plain = await buildWith(
      { name: 'button', from: 'imp/std', call: "button('Save')" },
      'plain',
    )
    check(
      drawing.includes('Copyright (c) Project Nayuki. (MIT License)') &&
        drawing.includes('The above copyright notice and this permission notice shall be included'),
      'an app that draws a qrCode carries the MIT notice of the QR Code generator library',
    )
    check(
      !plain.includes('Project Nayuki'),
      'an app that draws no qrCode carries no notice of the QR Code generator library',
    )
  } finally {
    await Deno.remove(project, { recursive: true })
  }
})

Deno.test('imp build reads adversarial HTML the way a browser does', async (t) => {
  const dir = await tempDir()
  await copyDirectory(fixture('build-html-edge'), dir)
  const mask = (text) =>
    text
      .replaceAll(dir, '<tmp>')
      .replace(/-[A-Z0-9]{8}\.(js|svg)/g, '-<hash>.$1')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')
  try {
    await t.step('build-html-edge', async () => {
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html')).catch(() => '(none)')
      const entry = html.match(/SRC=\/base\/(chunks\/app-[A-Z0-9]{8}\.js)/)?.[1]
      const bundle = entry ? await Deno.readTextFile(join(dir, 'dist', entry)) : ''
      const assetUrl = bundle.match(/"[^"]*logo-[A-Z0-9]{8}\.svg"/)?.[0] ?? '(none)'
      await assertSnapshot(
        'build-html-edge',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n` +
            `${section('dist/index.html', html)}\n\n` +
            `[imported asset url: ${assetUrl.replace(/-[A-Z0-9]{8}\.svg/, '-<hash>.svg')}]\n`,
        ),
      )
    })
    await t.step('lint-html-edge', async () => {
      const result = await runImp(['lint'], dir)
      await assertSnapshot(
        'lint-html-edge',
        mask(commandTranscript('imp lint  (cwd: <tmp>)', result)),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build writes the same files from any folder', async () => {
  const shallowRoot = await tempDir()
  const deepRoot = await tempDir()
  const projects = [
    { cwd: shallowRoot, folder: 'app' },
    { cwd: deepRoot, folder: join('a', 'longer', 'path', 'to', 'the', 'app') },
  ]
  const builds = []
  try {
    for (const { cwd, folder } of projects) {
      const dir = join(cwd, folder)
      await Deno.mkdir(dir, { recursive: true })
      await copyDirectory(fixture('build'), dir)
      const { code, stderr } = await runImp(
        ['build', join(folder, 'index.html'), '--output', join(folder, 'dist')],
        cwd,
      )
      check(code === 0, `imp build failed in ${dir}: ${stderr}`)
      const dist = join(dir, 'dist')
      const files = (await listFiles(dist)).sort()
      builds.push(
        await Promise.all(
          files.map(async (file) => `${file}\n${await Deno.readTextFile(join(dist, file))}`),
        ),
      )
    }
  } finally {
    await Deno.remove(shallowRoot, { recursive: true })
    await Deno.remove(deepRoot, { recursive: true })
  }
  const [first, second] = builds
  check(first.length > 3, `the build wrote ${first.length} files`)
  check(
    JSON.stringify(first) === JSON.stringify(second),
    `the two folders built different files:\n${first.map((file) => file.split('\n')[0])}\n${
      second.map((file) => file.split('\n')[0])
    }`,
  )
})

Deno.test('imp build stops when a script imports CSS', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('build-page'), dir)
  try {
    await Deno.writeTextFile(join(dir, 'card.css'), '.card { color: red }\n')
    await Deno.writeTextFile(join(dir, 'app.js'), "import './card.css'\nexport const card = 1\n")
    const result = await runImp(['build'], dir)
    check(result.code !== 0, 'a CSS import fails the build')
    check(
      result.stderr.includes("app.js imports './card.css' - a script cannot import CSS"),
      `the message names the script and the file:\n${result.stderr}`,
    )
    check(
      result.stderr.includes("A component carries its styles in its 'styles'"),
      'the message says where styles go',
    )
    const dist = await Deno.stat(join(dir, 'dist')).catch(() => null)
    check(dist === null, 'a failed build writes no output')
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build rewrites every url of the page and reports its inline code', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('build-page'), dir)
  try {
    const result = await runImp(['build'], dir)
    const html = await Deno.readTextFile(join(dir, 'dist', 'index.html')).catch(() => '(none)')
    await assertSnapshot(
      'build-page',
      `${
        commandTranscript('imp build  (cwd: <tmp>)', {
          ...result,
          stdout: result.stdout.replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)'),
        })
      }\n${section('dist/index.html', html)}\n`.replace(/-[A-Z0-9]{8}\.(js|css)/g, '-<hash>.$1'),
    )
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build --pwa', async (t) => {
  const dir = await tempDir()
  await copyDirectory(fixture('build-pwa'), dir)

  const mask = (text) =>
    text
      .replaceAll(dir, '<tmp>')
      .replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const outputTree = async () => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, 'dist'), 'dist/').catch(() => {})
    files.sort()
    return section('output files', files.join('\n'))
  }

  const isPng = async (path) => {
    const bytes = await Deno.readFile(join(dir, path))
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }

  const writeImpJson = (config) =>
    Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')

  try {
    await t.step('build-pwa', async () => {
      const result = await runImp(['build', '--pwa'], dir)
      const manifest = await Deno.readTextFile(join(dir, 'dist', 'manifest.webmanifest'))
      const sw = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const icons = [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
      ]
      const iconReport = []
      for (const icon of icons) {
        iconReport.push(`${icon}: ${(await isPng(`dist/${icon}`)) ? 'PNG' : 'NOT PNG'}`)
      }
      await assertSnapshot(
        'build-pwa',
        mask(
          `${
            commandTranscript('imp build --pwa  (cwd: <tmp>)', result)
          }\n${await outputTree()}\n\n` +
            `${section('dist/manifest.webmanifest', manifest)}\n\n` +
            `${section('dist/sw.js', workerReport(sw))}\n\n` +
            `${section('dist/index.html', html)}\n\n` +
            `${section('icon files', iconReport.join('\n'))}\n`,
        ),
      )
    })

    await t.step('build-pwa-png-source', async () => {
      await Deno.copyFile(
        join(dir, 'dist', 'icons', 'icon-512.png'),
        join(dir, 'assets', 'icon.png'),
      )
      await writeImpJson({
        pwa: {
          name: 'Fixture PWA',
          shortName: 'Fixture',
          themeColor: '#101828',
          backgroundColor: '#ffffff',
          display: 'standalone',
          icon: 'assets/icon.png',
        },
      })
      const result = await runImp(['build', '--pwa'], dir)
      const iconReport = `icons/icon-512.png: ${
        (await isPng('dist/icons/icon-512.png')) ? 'PNG' : 'NOT PNG'
      }`
      await assertSnapshot(
        'build-pwa-png-source',
        mask(
          `${commandTranscript('imp build --pwa  (cwd: <tmp>)', result)}\n` +
            `${section('icon from PNG source', iconReport)}\n`,
        ),
      )
    })

    await t.step('build-pwa-small-source-warns', async () => {
      await Deno.copyFile(
        join(dir, 'dist', 'icons', 'icon-192.png'),
        join(dir, 'assets', 'icon-small.png'),
      )
      await writeImpJson({
        pwa: {
          name: 'Fixture PWA',
          icon: 'assets/icon-small.png',
        },
      })
      const result = await runImp(['build', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-small-source-warns',
        mask(commandTranscript('imp build --pwa  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-pwa-no-block', async () => {
      await writeImpJson({})
      const result = await runImp(['build', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-no-block',
        mask(commandTranscript('imp build --pwa  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-pwa-js-entry', async () => {
      await writeImpJson({ pwa: { name: 'Fixture PWA', icon: 'assets/icon.svg' } })
      const result = await runImp(['build', 'app.js', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-js-entry',
        mask(commandTranscript('imp build app.js --pwa  (cwd: <tmp>)', result)),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

async function launchBrowser() {
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  return puppeteer.launch({ executablePath: await resolveBrowser(), headless: true, args })
}

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function serveFolder(folderOf, headers = {}) {
  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', onListen: () => {} },
    async (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      const file = path.endsWith('/') ? `${path}index.html` : path
      try {
        const bytes = await Deno.readFile(join(folderOf(), file))
        const type = STATIC_TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'
        return new Response(bytes, { headers: { 'content-type': type, ...headers } })
      } catch {
        return new Response('not found', { status: 404 })
      }
    },
  )
  return { server, base: `http://127.0.0.1:${server.addr.port}` }
}

Deno.test('imp build --pwa keeps the previous build for a running page', async () => {
  const dir = await tempDir()
  const html = '<!doctype html><html><head><title>update</title></head><body>' +
    '<script type="module" src="/app.js"></script></body></html>'
  const buildRelease = async (release) => {
    await Deno.writeTextFile(join(dir, 'index.html'), html)
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      JSON.stringify({ pwa: { name: 'Update', icon: 'icon.svg' } }),
    )
    await Deno.writeTextFile(
      join(dir, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>',
    )
    await Deno.writeTextFile(
      join(dir, 'app.js'),
      `globalThis.release = ${JSON.stringify(release)}\n` +
        `globalThis.loadPanel = () => import('./panel.js').then((module) => module.panel)\n`,
    )
    await Deno.writeTextFile(
      join(dir, 'panel.js'),
      `export const panel = ${JSON.stringify(`panel of ${release}`)}\n`,
    )
    const result = await runImp(['build', '--pwa', '--output', release], dir)
    check(result.code === 0, `build of ${release} failed:\n${result.stderr}`)
    return join(dir, release)
  }
  const releases = [
    await buildRelease('one'),
    await buildRelease('two'),
    await buildRelease('three'),
  ]
  let deployed = releases[0]
  const { server, base } = serveFolder(() => deployed)
  const browser = await launchBrowser()
  const updateWorker = (page) =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      const previous = registration.active
      await registration.update()
      await new Promise((resolve) => {
        const settle = () => {
          const worker = registration.active
          if (worker !== previous && worker?.state === 'activated') return resolve()
          setTimeout(settle, 50)
        }
        settle()
      })
    })
  const buildCaches = (page) =>
    page.evaluate(async () =>
      (await caches.keys()).filter((key) => key.startsWith('imp-pwa / ')).length
    )
  try {
    const page = await browser.newPage()
    await page.goto(`${base}/`)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    check(await page.evaluate(() => globalThis.release) === 'one', 'the first release did not load')

    deployed = releases[1]
    await updateWorker(page)
    check(
      await page.evaluate(() => globalThis.loadPanel()) === 'panel of one',
      'a lazy chunk of the running release did not load after the update',
    )
    check(await buildCaches(page) === 2, 'the update did not keep the previous build cache')

    const next = await browser.newPage()
    await next.goto(`${base}/`)
    check(
      await next.evaluate(() => globalThis.release) === 'two',
      'a navigation did not load the new release',
    )
    check(await buildCaches(next) === 2, 'a navigation removed the previous build cache')

    deployed = releases[2]
    await updateWorker(next)
    check(await buildCaches(next) === 2, 'the update did not remove the build before the previous')
    check(
      await next.evaluate(() => globalThis.loadPanel()) === 'panel of two',
      'a lazy chunk of the previous release did not load after the update',
    )
    await next.goto(`${base}/`)
    check(await buildCaches(next) === 2, 'a navigation removed the previous build cache')
    check(
      await next.evaluate(() => globalThis.release) === 'three',
      'the third release did not load',
    )
    check(
      await next.evaluate(() => globalThis.loadPanel()) === 'panel of three',
      'the lazy chunk of the current release did not load',
    )
  } finally {
    await browser.close()
    await server.shutdown()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('precacheBuild in a project worker serves the app offline', async () => {
  const dir = await tempDir()
  await Deno.mkdir(join(dir, 'src'))
  await Deno.writeTextFile(
    join(dir, 'index.html'),
    '<!doctype html><html><head><title>offline</title></head><body>' +
      '<script type="module" src="/app.js"></script></body></html>',
  )
  await Deno.writeTextFile(join(dir, 'app.js'), "globalThis.started = 'yes'\n")
  await Deno.writeTextFile(
    join(dir, 'src', 'sw.js'),
    "import { precacheBuild } from 'imp/service-worker'\n\nprecacheBuild()\n",
  )
  await Deno.writeTextFile(
    join(dir, 'icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>',
  )
  await Deno.writeTextFile(
    join(dir, 'imp.json'),
    JSON.stringify({ serviceWorker: 'src/sw.js', pwa: { name: 'Offline', icon: 'icon.svg' } }),
  )
  const result = await runImp(['build', '--pwa'], dir)
  check(result.code === 0, `the build failed:\n${result.stderr}`)
  const { server, base } = serveFolder(() => join(dir, 'dist'))
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto(`${base}/`)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    await server.shutdown()
    await page.goto(`${base}/invoices/7`)
    check(await page.evaluate(() => globalThis.started) === 'yes', 'the app did not start offline')
    check(await page.title() === 'offline', 'a deep link did not get the app shell offline')
  } finally {
    await browser.close()
    await server.shutdown().catch(() => {})
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build --pwa precaches only the files that the app loads from the host', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('build-pwa'), dir)
  const publicFiles = {
    'robots.txt': 'robots',
    'docs/guide.txt': 'guide',
    'a#b.txt': 'hash sign',
    '100%.txt': 'percent sign',
    'space name.txt': 'space',
    [`caf${String.fromCharCode(0xe9)}.txt`]: 'non-ascii',
    '_redirects': '/*  /app/index.html  200',
    '_headers': '/app/chunks/*\n  Cache-Control: immutable',
    '404.html': 'not found',
    'CNAME': 'app.example.com',
    'vercel.json': '{}',
    '.nojekyll': '',
    '.well-known/assetlinks.json': '[]',
  }
  for (const [name, text] of Object.entries(publicFiles)) {
    await Deno.mkdir(dirname(join(dir, 'public', name)), { recursive: true })
    await Deno.writeTextFile(join(dir, 'public', name), text)
  }
  await Deno.mkdir(join(dir, 'env'))
  await Deno.writeTextFile(join(dir, 'env', 'prod.json'), JSON.stringify({ IMP_BASEPATH: '/app' }))
  const config = JSON.parse(await Deno.readTextFile(join(dir, 'imp.json')))
  await Deno.writeTextFile(
    join(dir, 'imp.json'),
    JSON.stringify({ ...config, environments: { default: 'env/prod.json' } }),
  )
  const result = await runImp(['build', '--pwa', '--output', join('site', 'app')], dir)
  check(result.code === 0, `the build failed:\n${result.stderr}`)
  const worker = runServiceWorker(await Deno.readTextFile(join(dir, 'site', 'app', 'sw.js')))
  const { shell, hashed, required, optional } = worker.scope.__IMP_PRECACHE__
  const masked = (urls) => urls.map((url) => url.replace(/-[A-Z0-9]{8}\.js$/, '-<hash>.js')).sort()
  const same = (actual, expected, label) =>
    check(
      JSON.stringify(masked(actual)) === JSON.stringify(expected),
      `${label}: ${JSON.stringify(masked(actual))}`,
    )
  check(shell === '/app/index.html', `the shell is ${shell}`)
  same(
    hashed,
    [
      '/app/chunks/app-<hash>.js',
      '/app/chunks/env-<hash>.js',
      '/app/chunks/register-service-worker-<hash>.js',
    ],
    'hashed',
  )
  same(
    required,
    [
      '/app/icons/apple-touch-icon.png',
      '/app/icons/icon-192.png',
      '/app/icons/icon-512.png',
      '/app/icons/icon-maskable-512.png',
      '/app/index.html',
      '/app/manifest.webmanifest',
    ],
    'required',
  )
  same(
    optional,
    [
      '/app/100%25.txt',
      '/app/a%23b.txt',
      '/app/caf%C3%A9.txt',
      '/app/docs/guide.txt',
      '/app/robots.txt',
      '/app/space%20name.txt',
    ],
    'optional',
  )
  const { server, base } = serveFolder(() => join(dir, 'site'))
  try {
    for (const url of [...hashed, ...required, ...optional]) {
      const response = await fetch(`${base}${url}`)
      await response.body?.cancel()
      check(response.status === 200, `the host answered ${response.status} for ${url}`)
    }
    const served = await (await fetch(`${base}/app/a%23b.txt`)).text()
    check(served === 'hash sign', `the encoded url served ${served}`)
  } finally {
    await server.shutdown()
    await Deno.remove(dir, { recursive: true })
  }
})

const PWA_ORIGIN = 'https://pwa.test'

function fakeCacheStorage() {
  const stores = new Map()
  const keyOf = (request) => (typeof request === 'string' ? request : request.url)
  const usage = () =>
    [...stores.values()].flatMap((entries) => [...entries.values()])
      .reduce((sum, { body }) => sum + body.length, 0)
  const answer = ({ body, status, headers }) => new Response(body, { status, headers })
  const cacheOf = (entries) => ({
    put: async (request, response) => {
      const body = new Uint8Array(await response.arrayBuffer())
      const replaced = entries.get(keyOf(request))?.body.length ?? 0
      if (usage() - replaced + body.length > storage.quota) {
        throw new DOMException('the storage quota is full', 'QuotaExceededError')
      }
      entries.set(keyOf(request), { body, status: response.status, headers: [...response.headers] })
    },
    match: (request) => {
      const entry = entries.get(keyOf(request))
      return Promise.resolve(entry ? answer(entry) : undefined)
    },
  })
  const storage = {
    quota: Infinity,
    names: () => [...stores.keys()],
    keys: () => Promise.resolve([...stores.keys()]),
    has: (name) => Promise.resolve(stores.has(name)),
    open: (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      return Promise.resolve(cacheOf(stores.get(name)))
    },
    delete: (name) => Promise.resolve(stores.delete(name)),
    match: (request, { cacheName } = {}) => {
      for (const name of cacheName ? [cacheName] : stores.keys()) {
        const entry = stores.get(name)?.get(keyOf(request))
        if (entry) return Promise.resolve(answer(entry))
      }
      return Promise.resolve(undefined)
    },
  }
  return storage
}

function pwaOrigin(source) {
  const caches = fakeCacheStorage()
  const served = new Map()
  const origin = {
    caches,
    served,
    requests: [],
    warnings: [],
    clients: [],
    unreachable: new Set(),
    offline: false,
    now: 0,
  }
  const network = (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    origin.requests.push({ url, cache: init?.cache ?? 'default' })
    if (origin.offline || origin.unreachable.has(url)) {
      return Promise.reject(new TypeError('Failed to fetch'))
    }
    return Promise.resolve(
      served.has(url) ? new Response(served.get(url)) : new Response('not found', { status: 404 }),
    )
  }
  const workerConsole = {
    log: () => {},
    warn: (...parts) => origin.warnings.push(parts.join(' ')),
    error: (...parts) => origin.warnings.push(parts.join(' ')),
  }
  class WorkerDate extends Date {
    static now() {
      return origin.now
    }
  }
  const url = (path) => `${PWA_ORIGIN}${path}`

  origin.upload = (scopePath, { version, files, optional = {} }) => {
    for (const key of [...served.keys()]) {
      if (key.startsWith(url(scopePath))) served.delete(key)
    }
    for (const [name, body] of Object.entries({ ...files, ...optional })) {
      served.set(url(`${scopePath}${name}`), body)
    }
    const names = Object.keys(files)
    const paths = (list) => list.map((name) => `${scopePath}${name}`)
    return {
      version,
      shell: `${scopePath}index.html`,
      hashed: paths(names.filter((name) => name.startsWith('chunks/'))),
      required: paths(names.filter((name) => !name.startsWith('chunks/'))),
      optional: paths(Object.keys(optional)),
    }
  }

  origin.startWorker = (scopePath, precache) => {
    const listeners = {}
    const scope = {
      __IMP_PRECACHE__: precache,
      registration: { scope: url(scopePath) },
      location: new URL(url(`${scopePath}sw.js`)),
      addEventListener: (type, handler) => {
        listeners[type] = handler
      },
      skipWaiting: () => Promise.resolve(),
      clients: {
        claim: () => Promise.resolve(),
        matchAll: () => Promise.resolve(origin.clients.map((client) => ({ ...client }))),
      },
    }
    new Function('self', 'fetch', 'caches', 'globalThis', 'console', 'Date', source)(
      scope,
      network,
      caches,
      scope,
      workerConsole,
      WorkerDate,
    )
    const lifecycle = async (type) => {
      const pending = []
      listeners[type]({ waitUntil: (promise) => pending.push(promise) })
      await Promise.all(pending)
    }
    const dispatchFetch = async (path, mode) => {
      const pending = []
      let answered = null
      listeners.fetch({
        request: { url: url(path), method: 'GET', mode },
        respondWith: (value) => answered = value,
        waitUntil: (promise) => pending.push(promise),
      })
      try {
        const response = await (answered ?? network(url(path)))
        return response.type === 'error' ? null : await response.text()
      } catch {
        return null
      } finally {
        await Promise.all(pending)
      }
    }
    return {
      install: () => lifecycle('install'),
      activate: () => lifecycle('activate'),
      load: (path) => dispatchFetch(path, 'no-cors'),
      navigate: (path) => dispatchFetch(path, 'navigate'),
    }
  }

  origin.deploy = async (scopePath, release) => {
    const worker = origin.startWorker(scopePath, origin.upload(scopePath, release))
    await worker.install()
    await worker.activate()
    return worker
  }

  origin.buildCaches = (scopePath) =>
    caches.names().filter((name) => name.startsWith(`imp-pwa ${scopePath} `))

  return origin
}

async function offlineWorkerSource() {
  const dir = await tempDir()
  try {
    await copyDirectory(fixture('build-pwa'), dir)
    const result = await runImp(['build', '--pwa'], dir)
    check(result.code === 0, `the build failed:\n${result.stderr}`)
    const source = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
    return source.replace(/globalThis\.__IMP_PRECACHE__ = [^\n]*;\n/, '')
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
}

const appBuild = (tag, extra = {}) => ({
  version: tag,
  files: {
    'index.html': `page ${tag}`,
    'manifest.webmanifest': `manifest ${tag}`,
    [`chunks/app-${tag}.js`]: `app ${tag}`,
    [`chunks/lazy-${tag}.js`]: `lazy ${tag}`,
    ...extra,
  },
})

Deno.test('the offline worker of imp build --pwa', async (t) => {
  const source = await offlineWorkerSource()

  await t.step('apps on one origin keep the caches of each other', async () => {
    const origin = pwaOrigin(source)
    origin.clients = ['/a/', '/b/', '/c/'].map((path) => ({
      id: path,
      url: `${PWA_ORIGIN}${path}`,
    }))
    await origin.deploy('/b/', appBuild('b1'))
    const c = await origin.deploy('/c/', appBuild('c1'))
    const b = await origin.deploy('/b/', appBuild('b2'))
    let a = null
    for (const tag of ['a1', 'a2', 'a3', 'a4']) {
      a = await origin.deploy('/a/', appBuild(tag))
      await a.navigate('/a/')
    }
    check(origin.buildCaches('/a/').length === 2, `app a has ${origin.buildCaches('/a/')}`)
    check(origin.buildCaches('/b/').length === 2, `app b has ${origin.buildCaches('/b/')}`)
    check(origin.buildCaches('/c/').length === 1, `app c has ${origin.buildCaches('/c/')}`)
    origin.offline = true
    const loaded = [
      await a.load('/a/chunks/lazy-a4.js'),
      await a.load('/a/chunks/lazy-a3.js'),
      await b.load('/b/chunks/lazy-b2.js'),
      await b.load('/b/chunks/lazy-b1.js'),
      await c.load('/c/chunks/lazy-c1.js'),
      await b.navigate('/b/deep/link'),
    ]
    const expected = ['lazy a4', 'lazy a3', 'lazy b2', 'lazy b1', 'lazy c1', 'page b2']
    check(JSON.stringify(loaded) === JSON.stringify(expected), `offline: ${loaded}`)
  })

  await t.step('an optional file that fails does not block the install', async () => {
    const origin = pwaOrigin(source)
    const precache = origin.upload('/', {
      ...appBuild('v1'),
      optional: { 'robots.txt': 'robots', 'gone.txt': 'gone', 'far.txt': 'far' },
    })
    origin.served.delete(`${PWA_ORIGIN}/gone.txt`)
    origin.unreachable.add(`${PWA_ORIGIN}/far.txt`)
    const worker = origin.startWorker('/', precache)
    await worker.install()
    await worker.activate()
    check(
      origin.warnings.some((line) => line.includes('/gone.txt') && line.includes('404')),
      `no warning for the missing file: ${origin.warnings}`,
    )
    check(
      origin.warnings.some((line) => line.includes('/far.txt')),
      `no warning for the unreachable file: ${origin.warnings}`,
    )
    origin.offline = true
    check(await worker.load('/robots.txt') === 'robots', 'an optional file was not cached')
    check(await worker.load('/chunks/lazy-v1.js') === 'lazy v1', 'a chunk was not cached')
  })

  await t.step('a required file that fails keeps the previous build', async () => {
    const origin = pwaOrigin(source)
    const current = await origin.deploy('/', appBuild('v1'))
    const precache = origin.upload('/', appBuild('v2'))
    origin.served.delete(`${PWA_ORIGIN}/chunks/lazy-v2.js`)
    const failed = await origin.startWorker('/', precache).install().then(
      () => 'installed',
      (error) => error.message,
    )
    check(failed.includes('/chunks/lazy-v2.js'), `the install did not fail: ${failed}`)
    check(
      origin.buildCaches('/').length === 1,
      `the failed install left a cache: ${origin.caches.names()}`,
    )
    origin.offline = true
    check(await current.navigate('/') === 'page v1', 'the previous build did not serve offline')
  })

  await t.step('a full storage does not stop the updates', async () => {
    const origin = pwaOrigin(source)
    await origin.deploy('/', appBuild('v1'))
    origin.caches.quota = 400
    const big = 'x'.repeat(500)
    const worker = await origin.deploy('/', appBuild('v2', { 'chunks/big-v2.js': big }))
    check(
      origin.warnings.some((line) => line.includes('could not store')),
      `no warning for the full storage: ${origin.warnings}`,
    )
    check(await worker.load('/chunks/big-v2.js') === big, 'a file that did not fit did not load')
    const next = await origin.deploy('/', appBuild('v3'))
    origin.offline = true
    check(await next.navigate('/') === 'page v3', 'the next build did not install')
  })

  await t.step('a rollback keeps the build that the open tabs run', async () => {
    const origin = pwaOrigin(source)
    origin.clients = [{ id: 'tab', url: `${PWA_ORIGIN}/` }]
    for (const tag of ['v1', 'v2', 'v3']) await origin.deploy('/', appBuild(tag))
    await origin.deploy('/', appBuild('v2'))
    const worker = await origin.deploy('/', appBuild('v4'))
    origin.offline = true
    const loaded = [
      await worker.load('/chunks/lazy-v4.js'),
      await worker.load('/chunks/lazy-v2.js'),
      await worker.load('/chunks/lazy-v3.js'),
    ]
    check(
      JSON.stringify(loaded) === JSON.stringify(['lazy v4', 'lazy v2', null]),
      `after the rollback: ${JSON.stringify(loaded)}`,
    )
  })

  await t.step('the build caches stay bounded without a navigation', async () => {
    const origin = pwaOrigin(source)
    origin.clients = [{ id: 'tab', url: `${PWA_ORIGIN}/` }]
    let worker = null
    for (const tag of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
      worker = await origin.deploy('/', appBuild(tag))
      check(origin.buildCaches('/').length <= 2, `after ${tag}: ${origin.buildCaches('/')}`)
    }
    origin.now += 60000
    await worker.load('/chunks/app-v6.js')
    check(origin.buildCaches('/').length === 2, 'the grace cache went while its tab is open')
    origin.clients = []
    origin.now += 1000
    await worker.load('/chunks/app-v6.js')
    check(origin.buildCaches('/').length === 2, 'the worker checked the clients on every request')
    origin.now += 60000
    await worker.load('/chunks/app-v6.js')
    check(
      origin.buildCaches('/').length === 1,
      `the grace cache stayed after its tab closed: ${origin.buildCaches('/')}`,
    )
    await origin.deploy('/', appBuild('v7'))
    check(
      origin.buildCaches('/').length === 1,
      `an update with no open tab kept the grace cache: ${origin.buildCaches('/')}`,
    )
  })

  await t.step('an update copies the unchanged hashed files', async () => {
    const origin = pwaOrigin(source)
    await origin.deploy('/', appBuild('v1', { 'chunks/shared-1.js': 'shared' }))
    origin.requests.length = 0
    const worker = await origin.deploy('/', appBuild('v2', { 'chunks/shared-1.js': 'shared' }))
    const requested = origin.requests
      .map(({ url, cache }) => `${url.slice(PWA_ORIGIN.length)} ${cache}`)
      .sort()
    const expected = [
      '/chunks/app-v2.js default',
      '/chunks/lazy-v2.js default',
      '/index.html reload',
      '/manifest.webmanifest reload',
    ]
    check(JSON.stringify(requested) === JSON.stringify(expected), `requests: ${requested}`)
    origin.offline = true
    check(await worker.load('/chunks/shared-1.js') === 'shared', 'the copied file did not load')
  })
})

const STRICT_POLICY = "script-src 'self'; style-src 'self'"

Deno.test('a built app runs under a strict Content Security Policy', async () => {
  const dir = await tempDir()
  const write = async (path, text) => {
    await Deno.mkdir(dirname(join(dir, path)), { recursive: true })
    await Deno.writeTextFile(join(dir, path), text)
  }
  await write(
    'index.html',
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>csp</title>' +
      '<link rel="stylesheet" href="/styles.css"></head><body><div id="app"></div>' +
      '<script type="module" src="/src/main.js"></script>' +
      '<script type="module">globalThis.inlineRan = \'yes\'</script></body></html>',
  )
  await write('public/styles.css', 'body { margin: 0; }\n')
  await write(
    'src/main.js',
    [
      "import { env, mount } from 'imp'",
      "import { div } from 'imp/html'",
      "import { button } from 'imp/std'",
      "import { breadcrumbs } from 'imp/std/shell'",
      '',
      "mount('#app', () =>",
      '  div(',
      "    div({ id: 'greeting' }, env.GREETING),",
      "    div({ id: 'styled', style: 'color: rgb(1, 2, 3)' }, 'styled'),",
      "    button({ variant: 'primary' }, 'Save'),",
      '    breadcrumbs({',
      '      items: [',
      "        { id: 'home', label: 'Home', href: '/' },",
      "        { id: 'repo', label: 'imp', href: '/imp', options: [{ id: 'a', label: 'a', href: '/a' }] },",
      '      ],',
      '    }),',
      '  ))',
      '',
    ].join('\n'),
  )
  await write('env/prod.json', JSON.stringify({ GREETING: 'hello </script> <!-- world' }))
  await write(
    'icon.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>',
  )
  await write(
    'imp.json',
    JSON.stringify({
      environments: { default: 'env/prod.json' },
      pwa: { name: 'Strict', icon: 'icon.svg' },
    }),
  )
  const result = await runImp(['build', '--pwa'], dir)
  check(result.code === 0, `the build failed:\n${result.stderr}`)
  const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
  check(
    [...readHtml(html).scripts].every((script) => script.src !== null && script.text === ''),
    `the built page still has an inline script:\n${html}`,
  )
  const { server, base } = serveFolder(() => join(dir, 'dist'), {
    'content-security-policy': STRICT_POLICY,
  })
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const reports = []
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) reports.push(message.text())
    })
    await page.evaluateOnNewDocument(() => {
      globalThis.impViolations = []
      document.addEventListener('securitypolicyviolation', (event) => {
        globalThis.impViolations.push(`${event.violatedDirective} ${event.blockedURI}`)
      }, true)
    })
    await page.goto(`${base}/`)
    await page.waitForFunction(() => document.querySelector('imp-breadcrumbs')?.shadowRoot)
    const state = await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      const crumbs = document.querySelector('imp-breadcrumbs').shadowRoot
      return {
        inline: globalThis.inlineRan,
        greeting: document.querySelector('#greeting').textContent,
        styled: getComputedStyle(document.querySelector('#styled')).color,
        anchor: getComputedStyle(crumbs.querySelector('.picker')).anchorName,
        violations: [...globalThis.impViolations],
      }
    })
    check(state.inline === 'yes', 'the inline module script did not run')
    check(state.greeting === 'hello </script> <!-- world', `env value: ${state.greeting}`)
    check(state.styled === 'rgb(1, 2, 3)', `a string style was blocked: ${state.styled}`)
    check(state.anchor === '--imp-crumb-1', `the breadcrumbs anchor was blocked: ${state.anchor}`)
    check(
      state.violations.length === 0 && reports.length === 0,
      `CSP violations: ${JSON.stringify([...state.violations, ...reports])}`,
    )
    const probe = await page.evaluate(async () => {
      document.body.setAttribute('style', 'color: red')
      await new Promise((resolve) => setTimeout(resolve, 100))
      return globalThis.impViolations.length
    })
    check(probe === 1, 'the policy is not active, so the check above proves nothing')
  } finally {
    await browser.close()
    await server.shutdown()
    await Deno.remove(dir, { recursive: true })
  }
})
