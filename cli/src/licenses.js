const LICENSES_URL = new URL('../../THIRD_PARTY_LICENSES.md', import.meta.url)

export async function printLicenses() {
  const text = await Deno.readTextFile(LICENSES_URL)
  console.log(text.trimEnd())
}
