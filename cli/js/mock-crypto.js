export const mockCrypto = ({ randomBytes }) => {
  const MAX_BYTES = 65536

  const getRandomValues = (array) => {
    if (!ArrayBuffer.isView(array) || array instanceof DataView) {
      throw new TypeError(
        'crypto.getRandomValues takes an integer typed array, like new Uint8Array(16)',
      )
    }
    if (array.byteLength > MAX_BYTES) {
      throw new RangeError(`crypto.getRandomValues fills at most ${MAX_BYTES} bytes at a time`)
    }
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
      randomBytes(array.byteLength),
    )
    return array
  }

  const randomUUID = () => {
    const bytes = getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  globalThis.crypto = { getRandomValues, randomUUID }
}
