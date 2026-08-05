import { dirname, join } from '@std/path'
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip-js/zip-js'
import { logger } from './logger.js'

export const CHROME_VERSION = '150.0.7871.46'

const CHROME_BUILDS = {
  'linux-x86_64': {
    platform: 'linux64',
    sha256: 'ad115a7498a17f53f6ed0914458326c6516addc756224db14c32184a9b1ab078',
    executable: ['chrome-linux64', 'chrome'],
  },
  'darwin-aarch64': {
    platform: 'mac-arm64',
    sha256: '9b6c6fbbda6f2948c74425828bd18f0e59542fd2beb056697478c38a956d83cb',
    executable: [
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ],
  },
  'darwin-x86_64': {
    platform: 'mac-x64',
    sha256: 'dc6280df5fa5cb1da96f7026a20d7622df921fa5ba03c07e95af4a8dde17b131',
    executable: [
      'chrome-mac-x64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ],
  },
  'windows-x86_64': {
    platform: 'win64',
    sha256: '2245f764e024897195bce1cf6ff16d60544351e4d1b68edb6956ea875ab8b929',
    executable: ['chrome-win64', 'chrome.exe'],
  },
}

const SYSTEM_BROWSERS = {
  linux: {
    commands: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'],
    paths: [],
  },
  darwin: {
    commands: [],
    paths: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
  },
  windows: {
    commands: [],
    paths: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  },
}

const homeDirectory = () => Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE')

export const browserCacheDirectory = () =>
  join(homeDirectory() ?? '.', '.imp', 'browser', `chrome-${CHROME_VERSION}`)

const isExecutableFile = async (path) => {
  try {
    return (await Deno.stat(path)).isFile
  } catch {
    return false
  }
}

async function findOnPath(commands) {
  const pathValue = Deno.env.get('PATH') ?? ''
  for (const directory of pathValue.split(Deno.build.os === 'windows' ? ';' : ':')) {
    if (!directory) continue
    for (const command of commands) {
      const candidate = join(directory, command)
      if (await isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

export async function findSystemBrowser() {
  const { commands, paths } = SYSTEM_BROWSERS[Deno.build.os] ?? { commands: [], paths: [] }
  for (const path of paths) {
    if (await isExecutableFile(path)) return path
  }
  return commands.length ? await findOnPath(commands) : null
}

const currentBuild = () => {
  const build = CHROME_BUILDS[`${Deno.build.os}-${Deno.build.arch}`]
  if (!build) {
    throw new Error(
      `no managed browser build for ${Deno.build.os}-${Deno.build.arch} - point imp at an installed Chrome or Chromium via "test": { "browser": "<path>" } in imp.json`,
    )
  }
  return build
}

export async function findCachedBrowser() {
  const build = CHROME_BUILDS[`${Deno.build.os}-${Deno.build.arch}`]
  if (!build) return null
  const path = join(browserCacheDirectory(), ...build.executable)
  return (await isExecutableFile(path)) ? path : null
}

const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

const SYMLINK_MODE = 0o120000
const FILE_TYPE_MASK = 0o170000

async function extractZip(bytes, directory) {
  const reader = new ZipReader(new BlobReader(new Blob([bytes])))
  const symlinks = []
  try {
    for (const entry of await reader.getEntries()) {
      if (entry.directory) continue
      const mode = entry.externalFileAttributes >>> 16
      const path = join(directory, ...entry.filename.split('/'))
      const data = await entry.getData(new Uint8ArrayWriter())
      if ((mode & FILE_TYPE_MASK) === SYMLINK_MODE) {
        symlinks.push({ target: new TextDecoder().decode(data), path })
        continue
      }
      await Deno.mkdir(dirname(path), { recursive: true })
      await Deno.writeFile(path, data, { mode: (mode & 0o777) || 0o644 })
    }
    for (const { target, path } of symlinks) {
      await Deno.mkdir(dirname(path), { recursive: true })
      await Deno.remove(path).catch(() => {})
      await Deno.symlink(target, path)
    }
  } finally {
    await reader.close()
  }
}

export async function downloadBrowser() {
  const build = currentBuild()
  const url =
    `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${build.platform}/chrome-${build.platform}.zip`
  logger.info(
    `downloading Chrome ${CHROME_VERSION} for e2e tests (one-time, cached in ~/.imp/browser)…`,
  )
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`browser download failed: ${response.status} ${url}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const digest = toHex(await crypto.subtle.digest('SHA-256', bytes))
  if (digest !== build.sha256) {
    throw new Error(
      `browser download checksum mismatch for ${url}\n  expected ${build.sha256}\n  received ${digest}`,
    )
  }
  const directory = browserCacheDirectory()
  await Deno.remove(directory, { recursive: true }).catch(() => {})
  await extractZip(bytes, directory)
  const executable = join(directory, ...build.executable)
  if (!(await isExecutableFile(executable))) {
    throw new Error(`browser download completed but no executable at ${executable}`)
  }
  logger.info(`browser ready: ${executable}`)
  return executable
}

export async function resolveBrowser(configuredPath) {
  if (configuredPath) {
    if (!(await isExecutableFile(configuredPath))) {
      throw new Error(`configured test browser not found: ${configuredPath}`)
    }
    return configuredPath
  }
  const fromEnvironment = Deno.env.get('IMP_BROWSER')
  if (fromEnvironment) {
    if (!(await isExecutableFile(fromEnvironment))) {
      throw new Error(`IMP_BROWSER points to a missing file: ${fromEnvironment}`)
    }
    return fromEnvironment
  }
  return (await findSystemBrowser()) ?? (await findCachedBrowser()) ?? (await downloadBrowser())
}
