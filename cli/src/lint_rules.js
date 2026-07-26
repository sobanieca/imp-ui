import {
  defaultAlias,
  DEPENDENCY_SCHEME,
  EXACT_VERSION,
  impSubpathProblem,
  isImpSubpath,
  parseSpecifier,
} from './specifiers.js'
import { stateNameProblem } from '../../lib/src/state.js'
import { componentNameProblem } from '../../lib/src/component.js'
import * as impModule from '../../lib/src/imp.js'
import * as htmlModule from '../../lib/src/api/html.js'
import * as stateModule from '../../lib/src/api/state.js'
import * as routerModule from '../../lib/src/api/router.js'
import * as themeModule from '../../lib/src/api/theme.js'
import * as logModule from '../../lib/src/api/log.js'

const EXPORTS_BY_SPECIFIER = {
  'imp': impModule,
  'imp/html': htmlModule,
  'imp/state': stateModule,
  'imp/router': routerModule,
  'imp/theme': themeModule,
  'imp/log': logModule,
}

const EXPORT_HOMES = new Map(
  Object.entries(EXPORTS_BY_SPECIFIER).flatMap(([specifier, module]) =>
    Object.keys(module).map((name) => [name, specifier])
  ),
)

const ELEMENT_FACTORIES = new Set(
  Object.keys(htmlModule).filter((name) => name !== 'el' && name !== 'html'),
)

const STATE_SETUP_HELPERS = new Set(['initState', 'useState'])

const STATE_HANDLE_CREATORS = new Set(['initState', 'useState', 'computed'])

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

const literalArgumentName = (argument) => {
  if (!argument) return { known: true, name: undefined }
  if (argument.type === 'Literal') return { known: true, name: argument.value }
  if (argument.type === 'TemplateLiteral' && argument.expressions.length === 0) {
    return { known: true, name: argument.quasis[0].value.cooked }
  }
  return { known: false }
}

const importedName = (specifier) => specifier.imported.name ?? specifier.imported.value

const sortsAfter = (existing, added) =>
  existing.toLowerCase().localeCompare(added.toLowerCase()) > 0

const collectImpImports = (node, source, classify, locals, namespaceLocals) => {
  if (node.source.value !== source) return
  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier') {
      const classified = classify(importedName(specifier))
      if (classified !== null) locals.set(specifier.local.name, classified)
    } else if (specifier.type === 'ImportNamespaceSpecifier') {
      namespaceLocals.add(specifier.local.name)
    }
  }
}

const namespaceCalleeName = (callee, namespaceLocals) =>
  callee.type === 'MemberExpression' && !callee.computed &&
    callee.object.type === 'Identifier' && namespaceLocals.has(callee.object.name) &&
    callee.property.type === 'Identifier'
    ? callee.property.name
    : null

const createLiteralNameRule = (source, helperNames, nameProblem) => ({
  create(context) {
    const helperLocals = new Map()
    const namespaceLocals = new Set()
    const calls = []

    const isHelperCall = (callee) => {
      if (callee.type === 'Identifier') return helperLocals.has(callee.name)
      return helperNames.has(namespaceCalleeName(callee, namespaceLocals))
    }

    return {
      ImportDeclaration(node) {
        collectImpImports(
          node,
          source,
          (name) => helperNames.has(name) ? name : null,
          helperLocals,
          namespaceLocals,
        )
      },
      CallExpression(node) {
        calls.push(node)
      },
      'Program:exit'() {
        for (const node of calls) {
          if (!isHelperCall(node.callee)) continue
          const { known, name } = literalArgumentName(node.arguments[0])
          if (!known) continue
          const problem = nameProblem(name)
          if (problem) context.report({ node: node.arguments[0] ?? node, message: problem })
        }
      },
    }
  },
})

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

        const factoryKind = (callee) => {
          if (callee.type === 'Identifier') return factoryLocals.get(callee.name) ?? null
          const name = namespaceCalleeName(callee, namespaceLocals)
          return name === null ? null : classifyFactory(name)
        }

        const factoryName = (callee) =>
          callee.type === 'Identifier' ? callee.name : callee.property.name

        return {
          ImportDeclaration(node) {
            collectImpImports(node, 'imp/html', classifyFactory, factoryLocals, namespaceLocals)
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
    'state-name-namespace': createLiteralNameRule(
      'imp/state',
      STATE_SETUP_HELPERS,
      stateNameProblem,
    ),
    'state-setup-before-await': {
      create(context) {
        const creatorLocals = new Map()
        const namespaceLocals = new Set()
        const handleNames = new Set()
        const functions = []
        const candidates = []

        const calledCreator = (callee) => {
          if (callee.type === 'Identifier') return creatorLocals.get(callee.name) ?? null
          const name = namespaceCalleeName(callee, namespaceLocals)
          return name !== null && STATE_HANDLE_CREATORS.has(name) ? name : null
        }

        const isHandleCall = (expression) =>
          expression?.type === 'CallExpression' && calledCreator(expression.callee) !== null

        const watchedHandleName = (callee) =>
          callee.type === 'MemberExpression' && !callee.computed &&
            callee.property.type === 'Identifier' && callee.property.name === 'watch' &&
            callee.object.type === 'Identifier' && handleNames.has(callee.object.name)
            ? callee.object.name
            : null

        const isAsyncOnMount = (node) =>
          node.async && node.parent?.type === 'Property' && !node.parent.computed &&
          node.parent.value === node &&
          (node.parent.key.name === 'onMount' || node.parent.key.value === 'onMount')

        const enterFunction = (node) =>
          functions.push({ tracked: isAsyncOnMount(node), firstAwaitEnd: null })
        const exitFunction = () => functions.pop()

        const markAwait = (position) => {
          const current = functions.at(-1)
          if (current && current.firstAwaitEnd === null) current.firstAwaitEnd = position
        }

        return {
          ImportDeclaration(node) {
            collectImpImports(
              node,
              'imp/state',
              (name) => STATE_HANDLE_CREATORS.has(name) ? name : null,
              creatorLocals,
              namespaceLocals,
            )
          },
          VariableDeclarator(node) {
            if (node.id.type === 'Identifier' && isHandleCall(node.init)) {
              handleNames.add(node.id.name)
            }
          },
          AssignmentExpression(node) {
            if (
              node.operator === '=' && node.left.type === 'Identifier' && isHandleCall(node.right)
            ) {
              handleNames.add(node.left.name)
            }
          },
          FunctionDeclaration: enterFunction,
          'FunctionDeclaration:exit': exitFunction,
          FunctionExpression: enterFunction,
          'FunctionExpression:exit': exitFunction,
          ArrowFunctionExpression: enterFunction,
          'ArrowFunctionExpression:exit': exitFunction,
          AwaitExpression(node) {
            markAwait(node.range[1])
          },
          'ForOfStatement[await=true]'(node) {
            markAwait(node.range[0])
          },
          CallExpression(node) {
            const current = functions.at(-1)
            if (!current?.tracked || current.firstAwaitEnd === null) return
            if (node.range[0] < current.firstAwaitEnd) return
            candidates.push(node)
          },
          'Program:exit'() {
            for (const node of candidates) {
              const creator = calledCreator(node.callee)
              if (creator !== null && STATE_SETUP_HELPERS.has(creator)) {
                context.report({
                  node,
                  message:
                    `'${creator}' runs after an await in an async onMount — past the first await the mounting component is out of reach and the call throws; resolve states before the first await (set() and DOM built from the handles work after it)`,
                })
                continue
              }
              const handleName = watchedHandleName(node.callee)
              if (handleName !== null) {
                context.report({
                  node,
                  message:
                    `'${handleName}.watch' runs after an await in an async onMount — past the first await there is no mounting component to own the subscription and the call throws; call watch before the first await, or bind the state to DOM with text/view/each or a state-valued prop instead`,
                })
              }
            }
          },
        }
      },
    },
    'no-root-query-in-mount': {
      create(context) {
        const queryMethods = new Set(['querySelector', 'querySelectorAll', 'getElementById'])
        const frames = []

        const isOnMount = (node) =>
          node.parent?.type === 'Property' && !node.parent.computed &&
          node.parent.value === node &&
          (node.parent.key.name === 'onMount' || node.parent.key.value === 'onMount')

        const rootSpecOf = (node) => {
          const first = node.params[0]
          if (!first) return null
          if (first.type === 'Identifier') return { kind: 'param', name: first.name }
          if (first.type === 'ObjectPattern') {
            for (const property of first.properties) {
              if (
                property.type === 'Property' && !property.computed &&
                property.key.type === 'Identifier' && property.key.name === 'root' &&
                property.value.type === 'Identifier'
              ) {
                return { kind: 'binding', name: property.value.name }
              }
            }
          }
          return null
        }

        const isRootExpression = (expression, spec) =>
          spec.kind === 'binding'
            ? expression.type === 'Identifier' && expression.name === spec.name
            : expression.type === 'MemberExpression' && !expression.computed &&
              expression.property.type === 'Identifier' && expression.property.name === 'root' &&
              expression.object.type === 'Identifier' && expression.object.name === spec.name

        const enterFunction = (node) => frames.push(isOnMount(node) ? rootSpecOf(node) : null)
        const exitFunction = () => frames.pop()

        return {
          FunctionExpression: enterFunction,
          'FunctionExpression:exit': exitFunction,
          ArrowFunctionExpression: enterFunction,
          'ArrowFunctionExpression:exit': exitFunction,
          CallExpression(node) {
            const spec = frames.at(-1)
            if (!spec) return
            const callee = node.callee
            if (
              callee.type === 'MemberExpression' && !callee.computed &&
              callee.property.type === 'Identifier' && queryMethods.has(callee.property.name) &&
              isRootExpression(callee.object, spec)
            ) {
              context.report({
                node,
                message:
                  `the shadow root is queried in onMount before the returned DOM is placed — onMount's output fills the shadow root only after onMount returns (after the awaited promise resolves, for an async onMount), so this finds the placeholder, not your content; keep a reference to the node you build and use it directly, or run the query after placement with instance.afterMount(callback), which imp flushes on the next frame once your DOM is laid out on the page`,
              })
            }
          },
        }
      },
    },
    'component-name': createLiteralNameRule('imp', new Set(['component']), componentNameProblem),
    'import-source': {
      meta: { fixable: 'code' },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode()
        const declarations = []
        const misplaced = []

        const namedOnly = (declaration) =>
          declaration.specifiers.length > 0 &&
          declaration.specifiers.every((specifier) => specifier.type === 'ImportSpecifier')

        const homeDeclaration = (home, exclude) =>
          declarations.find((declaration) =>
            declaration !== exclude && declaration.source.value === home && namedOnly(declaration)
          ) ?? null

        const indentationOf = (declaration) => {
          const text = sourceCode.getText()
          const lineStart = text.lastIndexOf('\n', declaration.range[0] - 1) + 1
          const prefix = text.slice(lineStart, declaration.range[0])
          return /^[ \t]*$/.test(prefix) ? prefix : ''
        }

        const endOfLine = (declaration) => {
          const text = sourceCode.getText()
          let end = declaration.range[1]
          while (text[end] === ' ' || text[end] === '\t') end++
          return text[end] === '\n' ? end + 1 : end
        }

        const insertIntoDeclaration = (fixer, declaration, text, name) => {
          const follower = declaration.specifiers.find((specifier) =>
            sortsAfter(importedName(specifier), name)
          )
          return follower
            ? fixer.insertTextBefore(follower, `${text}, `)
            : fixer.insertTextAfter(declaration.specifiers.at(-1), `, ${text}`)
        }

        const moveSpecifier = (fixer, { declaration, specifier, name, home }) => {
          const text = sourceCode.getText(specifier)
          const target = homeDeclaration(home, declaration)
          const remaining = declaration.specifiers.filter((other) => other !== specifier)
          if (remaining.length === 0 && !target) {
            return fixer.replaceText(declaration, `import { ${text} } from '${home}'`)
          }
          const removal = remaining.length === 0
            ? fixer.removeRange([declaration.range[0], endOfLine(declaration)])
            : fixer.replaceTextRange(
              [declaration.specifiers[0].range[0], declaration.specifiers.at(-1).range[1]],
              remaining.map((other) => sourceCode.getText(other)).join(', '),
            )
          const addition = target
            ? insertIntoDeclaration(fixer, target, text, name)
            : fixer.insertTextAfter(
              declaration,
              `\n${indentationOf(declaration)}import { ${text} } from '${home}'`,
            )
          return [removal, addition]
        }

        return {
          ImportDeclaration(node) {
            declarations.push(node)
            const source = node.source.value
            if (!Object.hasOwn(EXPORTS_BY_SPECIFIER, source)) return
            for (const specifier of node.specifiers) {
              if (specifier.type !== 'ImportSpecifier') continue
              const name = importedName(specifier)
              const home = EXPORT_HOMES.get(name)
              if (!home || home === source) continue
              misplaced.push({ declaration: node, specifier, name, home, source })
            }
          },
          'Program:exit'() {
            for (const [index, entry] of misplaced.entries()) {
              context.report({
                node: entry.specifier,
                message:
                  `'${entry.name}' is not exported by '${entry.source}' — it comes from '${entry.home}': import { ${entry.name} } from '${entry.home}'`,
                fix: index === 0 ? (fixer) => moveSpecifier(fixer, entry) : undefined,
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
            specifier === 'imp' || specifier === 'imp/test' || specifier === 'imp/preview' ||
            isImpSubpath(specifier) || isRelativeOrUrl(specifier) || aliases.has(specifier)
          ) return
          if (specifier.startsWith('imp/') && !aliases.has(specifier)) {
            context.report({ node, message: impSubpathProblem(specifier) })
            return
          }
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
