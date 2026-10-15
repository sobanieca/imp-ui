import { component, mount } from 'imp'
import { qrCode } from 'imp/std/display'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { encodeQr } from '../src/std/display/qr-encode.js'

const REFERENCE = {
  L: [
    '17:01766a4f 32:d4125a09 53:5f10d2c7 78:34ba2c49 106:2c4783f8 134:a982cded 154:4bb54359',
    '192:2f408671 230:cab83472 271:fb569ac7 321:1bf12445 367:a0f4180b 425:bf013a3b',
    '458:c7e49be3 520:512257aa 586:361a19a1 644:253bfa10 718:317cf7dd 792:e58fadc3',
    '858:2f68c18d 929:59af20e0 1003:09a734e5 1091:4eb9a3b9 1171:54d95419 1273:e53ff7ca',
    '1367:78ad951b 1465:49bed971 1528:c2e75872 1628:678d4ebc 1732:6151718e 1840:a115fcc4',
    '1952:df1fd01f 2068:494292e4 2188:abdd24a7 2303:f9572699 2431:bba5fc85 2563:ef98ea39',
    '2699:cacf6cc9 2809:567d0ca6 2953:a65aea4b',
  ]
    .join(' ')
    .split(' '),
  M: [
    '14:fd9bf1cd 26:86cbc483 42:da0d0aff 62:fe6c67d9 84:c3e08c8c 106:97eaddd3 122:498145bf',
    '152:6f073d19 180:1cca5824 213:712f6803 251:75703521 287:b9231131 331:4cb2ca95',
    '362:875b4bd5 412:ad7d1cea 450:d4cc369f 504:9cb9bd8c 560:b325edfd 624:fc133531',
    '666:f658b479 711:33a14b56 779:a65704bd 857:699073b9 911:c8cd083b 997:dc27aae0',
    '1059:d11b1849 1125:0d649249 1190:8808cc3e 1264:5448fe48 1370:a0c8bdf6 1452:622d841e',
    '1538:86001dff 1628:26c8f2ea 1722:344c284f 1809:964403c5 1911:b321aedd 1989:dfa5cbc7',
    '2099:bfdd5e1d 2213:539b118c 2331:514c0399',
  ]
    .join(' ')
    .split(' '),
  Q: [
    '11:a4772099 20:c1171d8b 32:0b27f28d 46:3861e683 60:21552ea8 74:62f539c5 86:9106b04b',
    '108:56e5117d 130:1c3e5446 151:4cd2b5c9 177:cd912d71 203:afd44d4b 241:23992801',
    '258:298d2dbb 292:16063c5e 322:dd02be8f 364:967c7edc 394:a99f804f 442:cfa2b96f',
    '482:27c89209 509:789788fa 565:00ba0ddf 611:30105d0b 661:91315fbd 715:052811fa',
    '751:a9329c97 805:6f6baaf3 868:4d6b634c 908:db191840 982:8fe3b914 1030:26a2d5c8',
    '1112:23b4564d 1168:d827ff58 1228:a0ee6493 1283:7f9aabad 1351:463424ad 1423:72d2adc5',
    '1499:f1ed3333 1579:e22def0a 1663:cdc26c63',
  ]
    .join(' ')
    .split(' '),
  H: [
    '7:193cebb1 14:137df117 24:064041e3 34:8e91f3a9 44:ee931546 58:669b2543 64:3bd4fa69',
    '84:642c8a37 98:67f77e7e 119:c9128e23 137:b71f71e9 155:be42573d 177:eb111cc9',
    '194:fb5d4fb9 220:5d49bd94 250:9df8cd0f 280:6d56b08c 310:823f82f7 338:089f78bd',
    '382:ea2600b1 403:278ca6ac 439:5984e969 461:0a49544d 511:ec1f258f 535:24fe8df2',
    '593:c0c027f7 625:b3d4d7e5 658:90092150 698:163a19f2 742:03ab8c14 790:1f978058',
    '842:61b682ef 898:7a35e3c8 958:8a84194f 983:0ea5c61f 1051:66506b5b 1093:76d7fa87',
    '1139:eafc3c5b 1219:6b3b87f2 1273:5690e271',
  ]
    .join(' ')
    .split(' '),
}

const REFERENCE_URL = {
  text: 'https://imp.example.com',
  level: 'M',
  mask: 3,
  version: 2,
  rows: [
    '1fd697f 105d041 174995d 1758f5d 174d75d 104bc41 1fd557f 1d100 16ea34b 310922 e5c970',
    'd9b9bc c53ed7 e27771 cc6116 150a671 d5bff 18315 1fd0d57 1056311 17405fa 175485f 17582d6',
    '104fcd4 1fd303f',
  ]
    .join(' ')
    .split(' '),
}

const REFERENCE_UTF8 = {
  text: 'Za\u017c\u00f3\u0142\u0107 \u65e5\u672c \u{1f389}',
  level: 'Q',
  mask: 5,
  version: 3,
  rows: [
    '1fd4167f 10556641 174aa75d 17440b5d 1740a15d 104d8441 1fd5557f 52100 873f783 1911d120',
    '16f2d54 1434640e b541fff 785cee8 6d728e9 10becd43 76a12e7 1189cda0 1edce199 142487c1',
    '17d77bf3 1fc71c 1fdbe554 10432311 17429ff4 174a183e 1746877e 105f6156 1fc118a0',
  ]
    .join(' ')
    .split(' '),
}

const MASK_TESTS = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

const isVersion1Function = (x, y) =>
  (x < 9 && y < 9) || (x > 12 && y < 9) || (x < 9 && y > 12) || x === 6 || y === 6

const version1Codewords = ({ size, modules, mask }) => {
  const bits = []
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    const upward = ((right + 1) & 2) === 0
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step
      for (const x of [right, right - 1]) {
        if (!isVersion1Function(x, y)) bits.push(modules[y][x] !== MASK_TESTS[mask](x, y) ? 1 : 0)
      }
    }
  }
  const codewords = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    codewords.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0))
  }
  return codewords
}

const cellsOfPath = (d) => {
  const cells = new Set()
  let point = { x: 0, y: 0 }
  let start = point
  let corners = []
  for (const [, command, numbers] of d.matchAll(/([MmhvZz])([^MmhvZz]*)/g)) {
    const [a, b] = numbers
      .trim()
      .split(/[\s,]+|(?=-)/)
      .filter(Boolean)
      .map(Number)
    if (command === 'M') point = { x: a, y: b }
    if (command === 'm') point = { x: start.x + a, y: start.y + b }
    if (command === 'M' || command === 'm') {
      start = point
      corners = [point]
    }
    if (command === 'h') point = { x: point.x + a, y: point.y }
    if (command === 'v') point = { x: point.x, y: point.y + a }
    if (command === 'h' || command === 'v') corners.push(point)
    if (command === 'z' || command === 'Z') {
      const xs = corners.map((corner) => corner.x)
      const ys = corners.map((corner) => corner.y)
      for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
        for (let x = Math.min(...xs); x < Math.max(...xs); x++) cells.add(`${x},${y}`)
      }
      point = start
    }
  }
  return cells
}

const darkCells = ({ size, modules }, offset) => {
  const cells = new Set()
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) cells.add(`${x + offset},${y + offset}`)
    }
  }
  return cells
}

const textOfLength = (length) =>
  Array.from({ length }, (_, index) => String.fromCharCode(97 + ((index * 7) % 26))).join('')

const rowsOf = ({ size, modules }) =>
  Array.from({ length: size }, (_, y) => modules[y].map((dark) => (dark ? 1 : 0)).join(''))

const checksum = (text) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const hexRows = (code) => rowsOf(code).map((row) => BigInt(`0b${row}`).toString(16))

const stateHost = component('qr-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const svgOf = (host) => host.shadowRoot.querySelector('svg')

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('the encoder matches a reference encoder at the capacity of every version and level', () => {
  for (const level of ['L', 'M', 'Q', 'H']) {
    REFERENCE[level].forEach((entry, index) => {
      const version = index + 1
      const [length, expected] = entry.split(':')
      const text = textOfLength(Number(length))
      const code = encodeQr(text, { level, mask: version % 8 })
      expect({ level, version, found: code.version }).toEqual({ level, version, found: version })
      const longer = encodeQr(textOfLength(Number(length) + 1), { level, mask: 0 })
      expect({ level, version, next: longer?.version ?? null }).toEqual({
        level,
        version,
        next: version < 40 ? version + 1 : null,
      })
      expect({ level, version, sum: checksum(rowsOf(code).join('\n')) }).toEqual({
        level,
        version,
        sum: expected,
      })
    })
  }
})

test('the encoder matches a reference encoder module for module for a URL', () => {
  const code = encodeQr(REFERENCE_URL.text, { level: 'M', mask: REFERENCE_URL.mask })
  expect(code.version).toEqual(REFERENCE_URL.version)
  expect(hexRows(code)).toEqual(REFERENCE_URL.rows)
})

test('the encoder writes an ECI header and UTF-8 bytes, module for module like a reference encoder', () => {
  const code = encodeQr(REFERENCE_UTF8.text, { level: 'Q', mask: REFERENCE_UTF8.mask })
  expect(code.version).toEqual(REFERENCE_UTF8.version)
  expect(hexRows(code)).toEqual(REFERENCE_UTF8.rows)
})

test('a value with a character outside ASCII starts with the UTF-8 ECI header', () => {
  const code = encodeQr('\u00e9', { level: 'L', mask: 0 })
  expect(code.version).toEqual(1)
  expect(version1Codewords(code).slice(0, 8)).toEqual([
    0b01110001, 0b10100100, 0b00000010, 0xc3, 0xa9, 0x00, 0xec, 0x11,
  ])
})

test('an ASCII value has no ECI header', () => {
  const code = encodeQr('hi', { level: 'L', mask: 0 })
  expect(version1Codewords(code).slice(0, 6)).toEqual([0x40, 0x26, 0x86, 0x90, 0xec, 0x11])
})

test('the ECI header counts when the encoder picks the version', () => {
  const ascii = 'a'.repeat(17)
  const utf8 = `${'\u00e9'.repeat(8)}a`
  expect(new TextEncoder().encode(utf8).length).toEqual(17)
  expect(encodeQr(ascii, { level: 'L' }).version).toEqual(1)
  expect(encodeQr(utf8, { level: 'L' }).version).toEqual(2)
  expect(encodeQr('\u00e9'.repeat(8), { level: 'L' }).version).toEqual(1)
  expect(encodeQr('\u00e9'.repeat(1476), { level: 'L' }).version).toEqual(40)
  expect(encodeQr(`${'\u00e9'.repeat(1476)}a`, { level: 'L' })).toEqual(null)
})

test('the encoder picks one mask and the smallest version, and refuses a value that is too long', () => {
  const code = encodeQr('hello', { level: 'H' })
  expect(code.version).toEqual(1)
  expect(code.size).toEqual(21)
  expect(code.mask >= 0 && code.mask < 8).toBeTruthy()
  expect(encodeQr('x'.repeat(2953), { level: 'L' }).version).toEqual(40)
  expect(encodeQr('x'.repeat(2954), { level: 'L' })).toEqual(null)
})

test('qrCode draws one svg image with a name, a quiet zone and one path', () => {
  const host = mounted(qrCode({ value: 'https://imp.example.com' }))
  expect(host.localName).toEqual('imp-qr-code')
  const svg = svgOf(host)
  expect(svg.getAttribute('role')).toEqual('img')
  expect(svg.getAttribute('aria-label')).toEqual('QR code')
  expect(svg.getAttribute('viewBox')).toEqual('0 0 33 33')
  expect(svg.classList.contains('size-md')).toBeTruthy()
  expect(svg.querySelectorAll('path').length).toEqual(1)
  expect(svg.querySelector('path').getAttribute('d').startsWith('M4 4h7v1h-7z')).toBeTruthy()
})

test('the path draws each run of dark modules once, and covers exactly the dark modules', () => {
  for (const [value, level] of [
    ['https://imp.example.com', 'M'],
    [textOfLength(2953), 'L'],
  ]) {
    const host = mounted(qrCode({ value, errorCorrection: level }))
    const d = svgOf(host).querySelector('path').getAttribute('d')
    const code = encodeQr(value, { level })
    expect([...cellsOfPath(d)].sort().join(' ')).toEqual([...darkCells(code, 4)].sort().join(' '))
    const runs = code.modules.reduce(
      (count, row) => count + row.filter((dark, x) => dark && !row[x - 1]).length,
      0,
    )
    expect(d.split('z').length - 1).toEqual(runs)
  }
})

test('qrCode takes a label, a size and an error correction level', () => {
  const host = mounted(
    qrCode({ value: 'hello', label: 'Link to the app', size: 'lg', errorCorrection: 'H' }),
  )
  const svg = svgOf(host)
  expect(svg.getAttribute('aria-label')).toEqual('Link to the app')
  expect(svg.classList.contains('size-lg')).toBeTruthy()
  expect(svg.getAttribute('viewBox')).toEqual('0 0 29 29')
})

test('qrCode follows a value in a state and a label in a state', () => {
  let value = null
  let label = null
  const host = mounted(
    stateHost((self) => {
      value = initState(self, 'demo.qrValue', 'hi')
      label = initState(self, 'demo.qrLabel', 'First')
      return qrCode({ value, label })
    }),
  )
  const svg = () => host.shadowRoot.querySelector('imp-qr-code').shadowRoot.querySelector('svg')
  expect(svg().getAttribute('viewBox')).toEqual('0 0 29 29')
  value.set('x'.repeat(100))
  label.set('Second')
  expect(svg().getAttribute('viewBox')).not.toEqual('0 0 29 29')
  expect(svg().getAttribute('aria-label')).toEqual('Second')
  value.set('')
  expect(svg().hasAttribute('hidden')).toEqual(true)
  value.set('hi')
  expect(svg().hasAttribute('hidden')).toEqual(false)
})

test('qrCode warns about a value that is too long, and draws nothing', () => {
  const warn = warnings()
  const svg = svgOf(mounted(qrCode({ value: 'x'.repeat(3000), errorCorrection: 'L' })))
  expect(warned(warn, 'too long for a QR code')).toBeTruthy()
  expect(svg.hasAttribute('hidden')).toEqual(true)
  expect(svg.querySelector('path').getAttribute('d')).toEqual('')
})

test('qrCode warns about a missing value, a child and an unknown level', () => {
  const warn = warnings()
  mounted(qrCode({ errorCorrection: 'X' }, 'child'))
  expect(warned(warn, "needs a 'value'")).toBeTruthy()
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(warned(warn, 'errorCorrection')).toBeTruthy()
})
