import { LIBRARY_NAMESPACE } from './bundling.js'
import { readDependencyManifest, recordedNotices } from './dependency-manifest.js'
import { VERSION } from './version.js'

export const LICENSE_NOTICES_FILE = 'LICENSES.txt'

const IMP_LICENSE_URL = new URL('../../LICENSE', import.meta.url)

const LEGAL_COMMENT_FILE = '.LEGAL.txt'

const NOTICE_BLOCK = /\/\*[\s\S]*?\*\/|(?:^[ \t]*\/\/.*(?:\r?\n|$))+/gm

const HEADER = `Third-party license notices

Every license notice carried by the code bundled into this build is reproduced
below, one block per notice, exactly as its authors wrote it. Ship this file
alongside the build: the licenses it lists require the notice to travel with the
code. Every script imp emitted points back here.`

const LIBRARY_HEADING = `The imp library bundled into this build`

const RECORDED_HEADING = `Packages bundled into this build

Recorded when each dependency was installed, one block per package.`

const EMBEDDED_HEADING = `Notices carried in the bundled code`

function noticeBlocksIn(text) {
  return (text.match(NOTICE_BLOCK) ?? []).map((block) => block.trim()).filter(Boolean)
}

export function splitLicenseNotices(outputFiles) {
  const code = []
  const notices = new Set()
  for (const file of outputFiles) {
    if (file.path.endsWith(LEGAL_COMMENT_FILE)) {
      for (const block of noticeBlocksIn(file.text)) notices.add(block)
    } else {
      code.push(file)
    }
  }
  return { code, notices: [...notices] }
}

async function impLibraryNotice() {
  const text = await Deno.readTextFile(IMP_LICENSE_URL)
  return `imp@${VERSION} - MIT\n\n${text.trimEnd()}`
}

const bundlesImpLibrary = (inputs) =>
  inputs.some((input) => input.startsWith(`${LIBRARY_NAMESPACE}:`))

async function bundledDependencyManifests({ root, dependencies, inputs }) {
  const manifests = []
  const unrecorded = []
  for (const alias of Object.keys(dependencies)) {
    if (!inputs.some((input) => input.endsWith(`dependencies/${alias}/${alias}.js`))) continue
    const manifest = await readDependencyManifest(root, alias)
    if (manifest) manifests.push(manifest)
    else unrecorded.push(alias)
  }
  return { manifests, unrecorded }
}

export async function collectLicenseNotices({ root, dependencies, metafile, embedded }) {
  const inputs = Object.keys(metafile.inputs).map((input) => input.replaceAll('\\', '/'))
  const { manifests, unrecorded } = await bundledDependencyManifests({ root, dependencies, inputs })
  const notices = {
    library: bundlesImpLibrary(inputs) ? await impLibraryNotice() : null,
    recorded: recordedNotices(manifests),
    embedded,
  }
  return { notices, manifests, unrecorded }
}

export const unrecordedLicensesWarning = (unrecorded) =>
  `no manifest.json for ${unrecorded.join(', ')} - the licenses of ${
    unrecorded.length === 1 ? 'that dependency are' : 'those dependencies are'
  } missing from ${LICENSE_NOTICES_FILE}; run 'imp install' to record them`

export function licenseNoticesFile({ library, recorded, embedded }) {
  const sections = [HEADER]
  if (library) sections.push(LIBRARY_HEADING, library)
  if (recorded.length) sections.push(RECORDED_HEADING, ...recorded)
  if (embedded.length) sections.push(EMBEDDED_HEADING, ...embedded)
  return `${sections.join('\n\n')}\n`
}

export const licenseNoticeCount = ({ library, recorded, embedded }) =>
  (library ? 1 : 0) + recorded.length + embedded.length

export const licenseNoticesReference = (href) => `/*! Third-party license notices: ${href} */\n`
