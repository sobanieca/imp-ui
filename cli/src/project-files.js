const MOCK_FILE_SUFFIX = '.mock.js'

export const isUnitFile = (path) => path.endsWith('.test.js') || path.endsWith('.test.mjs')

export const isSpecFile = (path) => path.endsWith('.spec.js') || path.endsWith('.spec.mjs')

export const isTestFile = (path) => isUnitFile(path) || isSpecFile(path)

export const isPreviewFile = (path) => path.endsWith('.preview.js') || path.endsWith('.preview.mjs')

export const isMockFile = (path) => path.endsWith(MOCK_FILE_SUFFIX)
