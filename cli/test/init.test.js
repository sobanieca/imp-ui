import { join } from '@std/path'
import { fontBySlug, pickFont, SCAFFOLD_FONTS } from '../src/init.js'
import { check, REPO_ROOT } from './helpers.js'

const TEMPLATE_FONTS = join(REPO_ROOT, 'cli', 'src', 'templates', 'fonts')

const slugs = (fonts) => fonts.map((font) => font.slug).join(',')

Deno.test('imp init fonts', async (t) => {
  await t.step('pickFont takes the font from the random number it is given', () => {
    check(pickFont(() => 0).slug === 'inter', 'random 0 picks the first font')
    check(pickFont(() => 0.999999).slug === 'work-sans', 'random near 1 picks the last font')
  })

  await t.step('pickFont reaches every font of the list', () => {
    const picked = SCAFFOLD_FONTS.map((_, index) =>
      pickFont(() => (index + 0.5) / SCAFFOLD_FONTS.length)
    )
    check(slugs(picked) === slugs(SCAFFOLD_FONTS), `picked ${slugs(picked)}`)
  })

  await t.step('fontBySlug names every font it knows when the slug is unknown', () => {
    check(fontBySlug('dm-sans').name === 'DM Sans', 'dm-sans is DM Sans')
    let message = ''
    try {
      fontBySlug('Inter')
    } catch (error) {
      message = error.message
    }
    check(message.includes(`one of ${SCAFFOLD_FONTS.map((font) => font.slug).join(', ')}`), message)
  })

  await t.step('every scaffold font ships both subsets and its license text', async () => {
    const notices = await Deno.readTextFile(join(REPO_ROOT, 'THIRD-PARTY-LICENSES.md'))
    for (const font of SCAFFOLD_FONTS) {
      check(font.license === 'SIL Open Font License 1.1', `${font.slug} license`)
      for (const subset of ['latin', 'latin-ext']) {
        const bytes = await Deno.readFile(join(TEMPLATE_FONTS, `${font.slug}-${subset}.woff2`))
        check(new TextDecoder().decode(bytes.slice(0, 4)) === 'wOF2', `${font.slug} ${subset}`)
      }
      const license = await Deno.readTextFile(join(TEMPLATE_FONTS, `${font.slug}-ofl.txt`))
      const copyright = license.split('\n')[0]
      check(license.includes('SIL Open Font License, Version 1.1'), `${font.slug} is OFL 1.1`)
      check(copyright.startsWith('Copyright '), `${font.slug} starts with its copyright`)
      check(notices.includes(copyright), `THIRD-PARTY-LICENSES.md lacks: ${copyright}`)
    }
  })

  await t.step('the template folder holds the scaffold fonts and nothing else', async () => {
    const expected = SCAFFOLD_FONTS.flatMap((font) => [
      `${font.slug}-latin.woff2`,
      `${font.slug}-latin-ext.woff2`,
      `${font.slug}-ofl.txt`,
    ]).sort()
    const found = []
    for await (const entry of Deno.readDir(TEMPLATE_FONTS)) found.push(entry.name)
    check(found.sort().join(',') === expected.join(','), `found ${found.join(',')}`)
  })
})
