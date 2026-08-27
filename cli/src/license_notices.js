export const LICENSE_NOTICES_FILE = 'LICENSES.txt'

const LEGAL_COMMENT_FILE = '.LEGAL.txt'

const NOTICE_BLOCK = /\/\*[\s\S]*?\*\/|(?:^[ \t]*\/\/.*(?:\r?\n|$))+/gm

const HEADER = `Third-party license notices

Every license notice carried by the code bundled into this build is reproduced
below, one block per notice, exactly as its authors wrote it. Ship this file
alongside the build: the licenses it lists require the notice to travel with the
code. Every script imp emitted points back here.`

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

export const licenseNoticesFile = (notices) => `${[HEADER, ...notices].join('\n\n')}\n`

export const licenseNoticesReference = (href) => `/*! Third-party license notices: ${href} */\n`
