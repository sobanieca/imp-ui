const declaredFlags = () => globalThis.__IMP_FLAGS__ ?? {}

export function flag(name) {
  const declared = declaredFlags()
  if (!Object.hasOwn(declared, name)) {
    const names = Object.keys(declared)
    throw new Error(
      `imp: unknown flag '${name}' — ${
        names.length
          ? `declared flags: ${names.join(', ')}`
          : "no flags are declared in imp.json's 'flags'"
      }`,
    )
  }
  return declared[name] === true
}
