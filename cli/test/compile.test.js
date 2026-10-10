import { join } from '@std/path'
import { treeStamp } from '../../tools/compile.js'
import { check, tempDir } from './helpers.js'

const git = async (cwd, ...args) => {
  const { success } = await new Deno.Command('git', { args, cwd, stdout: 'null', stderr: 'null' })
    .output()
  check(success, `git ${args.join(' ')} failed`)
}

Deno.test('the compile stamp changes when a file is deleted, added or edited', async () => {
  const dir = await tempDir()
  try {
    await git(dir, 'init', '-q')
    await Deno.writeTextFile(join(dir, 'kept.js'), 'export const kept = 1\n')
    await Deno.writeTextFile(join(dir, 'gone.js'), 'export const gone = 1\n')
    await git(dir, 'add', '-A')
    const first = await treeStamp(dir)
    check(first === await treeStamp(dir), 'an unchanged tree keeps its stamp')

    await Deno.remove(join(dir, 'gone.js'))
    await git(dir, 'add', '-A')
    const afterDelete = await treeStamp(dir)
    check(afterDelete !== first, 'a deleted file changes the stamp')

    await Deno.writeTextFile(join(dir, 'new.js'), 'export const added = 1\n')
    const afterAdd = await treeStamp(dir)
    check(afterAdd !== afterDelete, 'an untracked new file changes the stamp')

    await Deno.writeTextFile(join(dir, 'kept.js'), 'export const kept = 22\n')
    check(await treeStamp(dir) !== afterAdd, 'an edited file changes the stamp')
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})
