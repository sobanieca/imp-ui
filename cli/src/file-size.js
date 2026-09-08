import { SEPARATOR } from '@std/path'

export const DEFAULT_MAX_FILE_BYTES = 200 * 1024

export const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const maxFileBytes = (config) => config.maxFileSize ?? DEFAULT_MAX_FILE_BYTES

export const isFileSizeIgnored = (relativePath, ignore = []) =>
  ignore.some((entry) => {
    const prefix = entry.replace(/\/+$/, '')
    return relativePath === prefix || relativePath.startsWith(prefix + SEPARATOR)
  })

export const maxFileSizeHint =
  'raise "maxFileSize" or add the path to "maxFileSizeIgnore" in imp.json'
