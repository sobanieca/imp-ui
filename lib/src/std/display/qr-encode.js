/*!
 * The QR code encoder of imp is a JavaScript adaptation of:
 *
 * QR Code generator library (TypeScript)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

export const EC_LEVELS = ['L', 'M', 'Q', 'H']

const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 }

const MIN_VERSION = 1

const MAX_VERSION = 40

const MASK_COUNT = 8

const BYTE_MODE = 0b0100

const ECI_MODE = 0b0111

const UTF8_ASSIGNMENT = 26

const ECI_BITS = 12

const PENALTY_RUN = 3

const PENALTY_BLOCK = 3

const PENALTY_FINDER = 40

const PENALTY_BALANCE = 10

const EC_CODEWORDS_PER_BLOCK = {
  L: '7 10 15 20 26 18 20 24 30 18 20 24 26 30 22 24 28 30 28 28 28 28 30 30 26 28 30 30 30 30 30 30 30 30 30 30 30 30 30 30',
  M: '10 16 26 18 24 16 18 22 22 26 30 22 22 24 24 28 28 26 26 26 26 28 28 28 28 28 28 28 28 28 28 28 28 28 28 28 28 28 28 28',
  Q: '13 22 18 26 18 24 18 22 20 24 28 26 24 20 30 24 28 28 26 30 28 30 30 30 30 28 30 30 30 30 30 30 30 30 30 30 30 30 30 30',
  H: '17 28 22 16 22 28 26 26 24 28 24 28 22 24 24 30 28 28 26 28 30 24 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30',
}

const EC_BLOCKS = {
  L: '1 1 1 1 1 2 2 2 2 4 4 4 4 4 6 6 6 6 7 8 8 9 9 10 12 12 12 13 14 15 16 17 18 19 19 20 21 22 24 25',
  M: '1 1 1 2 2 4 4 4 5 5 5 8 9 9 10 10 11 13 14 16 17 17 18 20 21 23 25 26 28 29 31 33 35 37 38 40 43 45 47 49',
  Q: '1 1 2 2 4 4 6 6 8 8 8 10 12 16 12 17 16 18 21 20 23 23 25 27 29 34 34 35 38 40 43 45 48 51 53 56 59 62 65 68',
  H: '1 1 2 4 4 4 5 6 8 8 11 11 16 16 18 16 19 21 25 25 25 34 30 32 35 37 40 42 45 48 51 54 57 60 63 66 70 74 77 81',
}

let tables = null

const parsedTables = () =>
  tables ??= Object.fromEntries(
    EC_LEVELS.map((level) => [level, {
      ecLength: EC_CODEWORDS_PER_BLOCK[level].split(' ').map(Number),
      blocks: EC_BLOCKS[level].split(' ').map(Number),
    }]),
  )

const ecLengthOf = (version, level) => parsedTables()[level].ecLength[version - 1]

const blockCountOf = (version, level) => parsedTables()[level].blocks[version - 1]

const bitAt = (value, index) => ((value >>> index) & 1) !== 0

const sizeOf = (version) => version * 4 + 17

const rawDataModules = (version) => {
  let modules = (16 * version + 128) * version + 64
  if (version >= 2) {
    const alignments = Math.floor(version / 7) + 2
    modules -= (25 * alignments - 10) * alignments - 55
    if (version >= 7) modules -= 36
  }
  return modules
}

const dataCodewords = (version, level) =>
  Math.floor(rawDataModules(version) / 8) -
  ecLengthOf(version, level) * blockCountOf(version, level)

const countBits = (version) => (version <= 9 ? 8 : 16)

const needsUtf8Header = (bytes) => bytes.some((byte) => byte >= 0x80)

const neededBits = (version, byteCount, utf8Header) =>
  (utf8Header ? ECI_BITS : 0) + 4 + countBits(version) + byteCount * 8

const fitsCount = (version, byteCount) => byteCount < 2 ** countBits(version)

const smallestVersion = (byteCount, level, utf8Header) => {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    if (!fitsCount(version, byteCount)) continue
    if (neededBits(version, byteCount, utf8Header) <= dataCodewords(version, level) * 8) {
      return version
    }
  }
  return null
}

const dataWithPadding = (bytes, version, level, utf8Header) => {
  const bits = []
  const append = (value, length) => {
    for (let index = length - 1; index >= 0; index--) bits.push(bitAt(value, index) ? 1 : 0)
  }
  if (utf8Header) {
    append(ECI_MODE, 4)
    append(UTF8_ASSIGNMENT, 8)
  }
  append(BYTE_MODE, 4)
  append(bytes.length, countBits(version))
  for (const byte of bytes) append(byte, 8)
  const capacity = dataCodewords(version, level) * 8
  append(0, Math.min(4, capacity - bits.length))
  append(0, (8 - (bits.length % 8)) % 8)
  const codewords = []
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0))
  }
  for (let pad = 0xec; codewords.length < capacity / 8; pad ^= 0xec ^ 0x11) codewords.push(pad)
  return codewords
}

const multiply = (left, right) => {
  let product = 0
  for (let index = 7; index >= 0; index--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d)
    product ^= ((right >>> index) & 1) * left
  }
  return product
}

const divisor = (degree) => {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let step = 0; step < degree; step++) {
    for (let index = 0; index < result.length; index++) {
      result[index] = multiply(result[index], root)
      if (index + 1 < result.length) result[index] ^= result[index + 1]
    }
    root = multiply(root, 0x02)
  }
  return result
}

const remainder = (data, generator) => {
  const result = new Array(generator.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ result.shift()
    result.push(0)
    for (let index = 0; index < result.length; index++) {
      result[index] ^= multiply(generator[index], factor)
    }
  }
  return result
}

const withErrorCorrection = (data, version, level) => {
  const blockCount = blockCountOf(version, level)
  const ecLength = ecLengthOf(version, level)
  const total = Math.floor(rawDataModules(version) / 8)
  const shortCount = blockCount - (total % blockCount)
  const shortLength = Math.floor(total / blockCount)
  const generator = divisor(ecLength)
  const blocks = []
  let offset = 0
  for (let index = 0; index < blockCount; index++) {
    const length = shortLength - ecLength + (index < shortCount ? 0 : 1)
    const part = data.slice(offset, offset + length)
    offset += length
    const block = [...part, ...remainder(part, generator)]
    if (index < shortCount) block.splice(length, 0, null)
    blocks.push(block)
  }
  const result = []
  for (let index = 0; index < blocks[0].length; index++) {
    for (const block of blocks) {
      if (block[index] !== null) result.push(block[index])
    }
  }
  return result
}

const alignmentPositions = (version) => {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const positions = [6]
  for (let position = sizeOf(version) - 7; positions.length < count; position -= step) {
    positions.splice(1, 0, position)
  }
  return positions
}

const createGrid = (size) => ({
  size,
  dark: Array.from({ length: size }, () => new Array(size).fill(false)),
  reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
})

const setFunction = (grid, x, y, isDark) => {
  grid.dark[y][x] = isDark
  grid.reserved[y][x] = true
}

const drawFinder = (grid, centerX, centerY) => {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      if (x < 0 || x >= grid.size || y < 0 || y >= grid.size) continue
      const distance = Math.max(Math.abs(dx), Math.abs(dy))
      setFunction(grid, x, y, distance !== 2 && distance !== 4)
    }
  }
}

const drawAlignment = (grid, centerX, centerY) => {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunction(grid, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }
}

const formatBits = (level, mask) => {
  const data = (FORMAT_BITS[level] << 3) | mask
  let rest = data
  for (let index = 0; index < 10; index++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537)
  return ((data << 10) | rest) ^ 0x5412
}

const drawFormat = (grid, level, mask) => {
  const bits = formatBits(level, mask)
  const { size } = grid
  for (let index = 0; index <= 5; index++) setFunction(grid, 8, index, bitAt(bits, index))
  setFunction(grid, 8, 7, bitAt(bits, 6))
  setFunction(grid, 8, 8, bitAt(bits, 7))
  setFunction(grid, 7, 8, bitAt(bits, 8))
  for (let index = 9; index < 15; index++) setFunction(grid, 14 - index, 8, bitAt(bits, index))
  for (let index = 0; index < 8; index++) setFunction(grid, size - 1 - index, 8, bitAt(bits, index))
  for (let index = 8; index < 15; index++) {
    setFunction(grid, 8, size - 15 + index, bitAt(bits, index))
  }
  setFunction(grid, 8, size - 8, true)
}

const drawVersion = (grid, version) => {
  if (version < 7) return
  let rest = version
  for (let index = 0; index < 12; index++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25)
  const bits = (version << 12) | rest
  for (let index = 0; index < 18; index++) {
    const a = grid.size - 11 + (index % 3)
    const b = Math.floor(index / 3)
    setFunction(grid, a, b, bitAt(bits, index))
    setFunction(grid, b, a, bitAt(bits, index))
  }
}

const drawFunctionPatterns = (grid, version, level) => {
  const { size } = grid
  for (let index = 0; index < size; index++) {
    setFunction(grid, 6, index, index % 2 === 0)
    setFunction(grid, index, 6, index % 2 === 0)
  }
  drawFinder(grid, 3, 3)
  drawFinder(grid, size - 4, 3)
  drawFinder(grid, 3, size - 4)
  const positions = alignmentPositions(version)
  const last = positions.length - 1
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
      if (!corner) drawAlignment(grid, positions[i], positions[j])
    }
  }
  drawFormat(grid, level, 0)
  drawVersion(grid, version)
}

const drawCodewords = (grid, codewords) => {
  const { size } = grid
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < size; step++) {
      for (let column = 0; column < 2; column++) {
        const x = right - column
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - step : step
        if (grid.reserved[y][x] || bit >= codewords.length * 8) continue
        grid.dark[y][x] = bitAt(codewords[bit >>> 3], 7 - (bit & 7))
        bit++
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

const applyMask = (grid, mask) => {
  const flips = MASKS[mask]
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.reserved[y][x] && flips(x, y)) grid.dark[y][x] = !grid.dark[y][x]
    }
  }
}

const finderPatterns = (history) => {
  const unit = history[1]
  const core = unit > 0 && history[2] === unit && history[3] === unit * 3 &&
    history[4] === unit && history[5] === unit
  return (core && history[0] >= unit * 4 && history[6] >= unit ? 1 : 0) +
    (core && history[6] >= unit * 4 && history[0] >= unit ? 1 : 0)
}

const lineScore = (size, moduleAt) => {
  let score = 0
  for (let line = 0; line < size; line++) {
    let color = false
    let run = 0
    const history = new Array(7).fill(0)
    const record = (length) => {
      if (history[0] === 0) length += size
      history.pop()
      history.unshift(length)
    }
    for (let index = 0; index < size; index++) {
      if (moduleAt(line, index) === color) {
        run++
        if (run === 5) score += PENALTY_RUN
        else if (run > 5) score++
      } else {
        record(run)
        if (!color) score += finderPatterns(history) * PENALTY_FINDER
        color = moduleAt(line, index)
        run = 1
      }
    }
    if (color) {
      record(run)
      run = 0
    }
    record(run + size)
    score += finderPatterns(history) * PENALTY_FINDER
  }
  return score
}

const penalty = ({ size, dark }) => {
  let score = lineScore(size, (y, x) => dark[y][x]) + lineScore(size, (x, y) => dark[y][x])
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = dark[y][x]
      if (color === dark[y][x + 1] && color === dark[y + 1][x] && color === dark[y + 1][x + 1]) {
        score += PENALTY_BLOCK
      }
    }
  }
  const darkCount = dark.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
  const total = size * size
  const steps = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1
  return score + steps * PENALTY_BALANCE
}

const copyGrid = (grid) => ({
  size: grid.size,
  dark: grid.dark.map((row) => [...row]),
  reserved: grid.reserved,
})

export function encodeQr(text, { level = 'M', mask = null } = {}) {
  const bytes = new TextEncoder().encode(text)
  const utf8Header = needsUtf8Header(bytes)
  const version = smallestVersion(bytes.length, level, utf8Header)
  if (version === null) return null
  const data = dataWithPadding(bytes, version, level, utf8Header)
  const codewords = withErrorCorrection(data, version, level)
  const base = createGrid(sizeOf(version))
  drawFunctionPatterns(base, version, level)
  drawCodewords(base, codewords)
  const candidates = mask === null ? [...Array(MASK_COUNT).keys()] : [mask]
  let best = null
  for (const candidate of candidates) {
    const grid = copyGrid(base)
    applyMask(grid, candidate)
    drawFormat(grid, level, candidate)
    const score = candidates.length === 1 ? 0 : penalty(grid)
    if (best === null || score < best.score) best = { grid, score, mask: candidate }
  }
  return { version, level, mask: best.mask, size: best.grid.size, modules: best.grid.dark }
}
