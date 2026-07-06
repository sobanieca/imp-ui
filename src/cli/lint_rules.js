import { defaultAlias, DEPENDENCY_SCHEME, EXACT_VERSION, parseSpecifier } from './specifiers.js'
import { TAGS } from '../lib/render.js'

const ELEMENT_FACTORIES = new Set(TAGS)

const classifyFactory = (importedName) => {
  if (importedName === 'el') return 'el'
  if (ELEMENT_FACTORIES.has(importedName)) return 'tag'
  return null
}

const exampleVersion = (version) => {
  const digits = version?.match(/\d+(\.\d+){0,2}/)?.[0]
  if (!digits) return '1.2.3'
  const parts = digits.split('.')
  while (parts.length < 3) parts.push('0')
  return parts.join('.')
}

export const dependencyPinProblem = (specifier) => {
  const parsed = parseSpecifier(specifier)
  if (!parsed?.scheme) {
    return `'${specifier}' must be an 'npm:' or 'jsr:' specifier (e.g. 'npm:mitt@3.0.1') — run 'imp install' to declare dependencies`
  }
  if (parsed.version && EXACT_VERSION.test(parsed.version)) return null
  const example = `${parsed.scheme}:${parsed.name}@${exampleVersion(parsed.version)}`
  const reason = parsed.version
    ? `'${parsed.version}' is not an exact version`
    : 'no version is given'
  return `'${specifier}' must pin an exact version (${reason}) — the vendored bundle in dependencies/ is built from this pin (e.g. '${example}'); run 'imp install' to re-resolve and re-pin it`
}

const isRelativeOrUrl = (specifier) =>
  specifier.startsWith('.') || specifier.startsWith('/') || /^[a-zA-Z][\w+.-]*:/.test(specifier)

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
    'single-props-object': {
      create(context) {
        const factoryLocals = new Map()
        const namespaceLocals = new Set()
        const calls = []

        const importedName = (specifier) => specifier.imported.name ?? specifier.imported.value

        const factoryKind = (callee) => {
          if (callee.type === 'Identifier') return factoryLocals.get(callee.name) ?? null
          if (
            callee.type === 'MemberExpression' && !callee.computed &&
            callee.object.type === 'Identifier' && namespaceLocals.has(callee.object.name) &&
            callee.property.type === 'Identifier'
          ) return classifyFactory(callee.property.name)
          return null
        }

        const factoryName = (callee) =>
          callee.type === 'Identifier' ? callee.name : callee.property.name

        return {
          ImportDeclaration(node) {
            if (node.source.value !== 'imp') return
            for (const specifier of node.specifiers) {
              if (specifier.type === 'ImportSpecifier') {
                const kind = classifyFactory(importedName(specifier))
                if (kind) factoryLocals.set(specifier.local.name, kind)
              } else if (specifier.type === 'ImportNamespaceSpecifier') {
                namespaceLocals.add(specifier.local.name)
              }
            }
          },
          CallExpression(node) {
            calls.push(node)
          },
          'Program:exit'() {
            for (const node of calls) {
              const kind = factoryKind(node.callee)
              if (!kind) continue
              const propsObjects = node.arguments
                .slice(kind === 'el' ? 1 : 0)
                .filter((argument) => argument.type === 'ObjectExpression')
              if (propsObjects.length < 2) continue
              context.report({
                node: propsObjects[1],
                message: `multiple props objects passed to '${
                  factoryName(node.callee)
                }' — pass a single props object; later keys win`,
              })
            }
          },
        }
      },
    },
    'exact-dependency-versions': {
      create(context) {
        const aliases = new Set(context.settings?.imp?.dependencyAliases ?? [])
        const check = (node) => {
          if (!node || typeof node.value !== 'string') return
          const specifier = node.value
          if (DEPENDENCY_SCHEME.test(specifier)) {
            const parsed = parseSpecifier(specifier)
            const installArg = specifier.replace(/^npm:/, '')
            const alias = parsed ? defaultAlias(parsed) : 'the-alias'
            context.report({
              node,
              message:
                `'${specifier}' is an inline dependency specifier — dependencies are vendored: run 'imp install ${installArg}' and import '${alias}' instead`,
            })
            return
          }
          if (
            specifier === 'imp' || specifier === 'imp/test' || isRelativeOrUrl(specifier) ||
            aliases.has(specifier)
          ) return
          context.report({
            node,
            message:
              `'${specifier}' is not a declared dependency — run 'imp install ${specifier}' to vendor it and add it to 'dependencies' in imp.json`,
          })
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
