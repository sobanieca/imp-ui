const DEVELOPMENT_GLOBAL = 'globalThis.__IMP_DEV__'

export const developmentChecksScript = () => `<script>${DEVELOPMENT_GLOBAL} = true</script>`

export const productionDefines = () => ({ [DEVELOPMENT_GLOBAL]: 'false' })
