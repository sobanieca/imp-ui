const DEPENDENCY_SPECIFIER = /^(npm|jsr):/

const EXACT_VERSION = /^\d+\.\d+\.\d+([-+][\w.-]+)?$/

const parseDependency = (specifier) => {
  const rest = specifier.replace(DEPENDENCY_SPECIFIER, '')
  const match = rest.match(/^(@[^/@]+\/[^/@]+|[^/@]+)(?:@([^/]+))?(?:\/.*)?$/)
  return { name: match?.[1], version: match?.[2] }
}

const exampleVersion = (version) => {
  const digits = version?.match(/\d+(\.\d+){0,2}/)?.[0]
  if (!digits) return '1.2.3'
  const parts = digits.split('.')
  while (parts.length < 3) parts.push('0')
  return parts.join('.')
}

export const dependencyVersionProblem = (specifier) => {
  if (!DEPENDENCY_SPECIFIER.test(specifier)) return null
  const { name, version } = parseDependency(specifier)
  if (version && EXACT_VERSION.test(version)) return null
  const example = `${specifier.split(':')[0]}:${name ?? 'package'}@${exampleVersion(version)}`
  const reason = version ? `'${version}' is not an exact version` : 'no version is given'
  return `'${specifier}' must pin an exact version (${reason}) — imp has no lock file, so exact versions (e.g. '${example}') keep dependency resolution reproducible`
}

export default {
  rules: {
    'no-capital-component': {
      create(context) {
        const report = (node, name) => {
          if (!/^[A-Z]/.test(name)) return
          context.report({
            node,
            message:
              `'${name}' starts with a capital letter — imp components are lowercase functions (write '${
                name[0].toLowerCase() + name.slice(1)
              }')`,
          })
        }
        return {
          FunctionDeclaration(node) {
            if (node.id) report(node.id, node.id.name)
          },
          VariableDeclarator(node) {
            if (
              node.id.type === 'Identifier' && node.init &&
              (node.init.type === 'ArrowFunctionExpression' ||
                node.init.type === 'FunctionExpression')
            ) {
              report(node.id, node.id.name)
            }
          },
        }
      },
    },
    'exact-dependency-versions': {
      create(context) {
        const check = (node) => {
          if (!node || typeof node.value !== 'string') return
          const problem = dependencyVersionProblem(node.value)
          if (problem) context.report({ node, message: problem })
        }
        return {
          ImportDeclaration(node) {
            check(node.source)
          },
          ExportNamedDeclaration(node) {
            check(node.source)
          },
          ExportAllDeclaration(node) {
            check(node.source)
          },
          ImportExpression(node) {
            if (node.source?.type === 'Literal') check(node.source)
          },
        }
      },
    },
  },
}
