import {
  defaultAlias,
  DEPENDENCY_SCHEME,
  EXACT_VERSION,
  impSubpathProblem,
  isImpSpecifier,
  isImpStdSpecifier,
  parseSpecifier,
} from './specifiers.js'
import { stateNameProblem } from '../../lib/src/state.js'
import { httpClientNameProblem } from '../../lib/src/http.js'
import { analyticsNameProblem } from '../../lib/src/analytics-bus.js'
import { componentNameProblem } from '../../lib/src/component.js'
import * as impModule from '../../lib/src/imp.js'
import * as htmlModule from '../../lib/src/api/html.js'
import * as stateModule from '../../lib/src/api/state.js'
import * as routerModule from '../../lib/src/api/router.js'
import * as themeModule from '../../lib/src/api/theme.js'
import * as i18nModule from '../../lib/src/api/i18n.js'
import * as logModule from '../../lib/src/api/log.js'
import * as httpModule from '../../lib/src/api/http.js'
import * as iconsModule from '../../lib/src/api/icons.js'
import * as serviceWorkerModule from '../../lib/src/api/service-worker.js'
import * as analyticsModule from '../../lib/src/api/analytics.js'
import * as stdModule from '../../lib/src/std/index.js'
import * as stdLayoutModule from '../../lib/src/std/layout/index.js'
import * as stdDisplayModule from '../../lib/src/std/display/index.js'
import * as stdInputsModule from '../../lib/src/std/inputs/index.js'
import * as stdShellModule from '../../lib/src/std/shell/index.js'
import * as stdFeedbackModule from '../../lib/src/std/feedback/index.js'
import * as stdDataModule from '../../lib/src/std/data/index.js'

export const IMP_MODULE_EXPORTS = {
  'imp': impModule,
  'imp/html': htmlModule,
  'imp/state': stateModule,
  'imp/router': routerModule,
  'imp/theme': themeModule,
  'imp/i18n': i18nModule,
  'imp/log': logModule,
  'imp/http': httpModule,
  'imp/icons': iconsModule,
  'imp/service-worker': serviceWorkerModule,
  'imp/analytics': analyticsModule,
  'imp/std': stdModule,
  'imp/std/layout': stdLayoutModule,
  'imp/std/display': stdDisplayModule,
  'imp/std/inputs': stdInputsModule,
  'imp/std/shell': stdShellModule,
  'imp/std/feedback': stdFeedbackModule,
  'imp/std/data': stdDataModule,
}

const STD_SPECIFIERS = Object.keys(IMP_MODULE_EXPORTS).filter(isImpStdSpecifier)

const API_SPECIFIERS = Object.keys(IMP_MODULE_EXPORTS).filter(
  (specifier) => !isImpStdSpecifier(specifier),
)

const EXPORT_HOMES = new Map(
  API_SPECIFIERS.flatMap((specifier) =>
    Object.keys(IMP_MODULE_EXPORTS[specifier]).map((name) => [name, specifier])
  ),
)

const ELEMENT_FACTORIES = new Set(
  Object.keys(htmlModule).filter((name) => name !== 'el' && name !== 'html'),
)

const STD_PLAIN_FUNCTIONS = new Set(['notify', 'dismiss'])

const STD_COMPONENTS = new Set(
  STD_SPECIFIERS
    .flatMap((specifier) => Object.keys(IMP_MODULE_EXPORTS[specifier]))
    .filter((name) => !STD_PLAIN_FUNCTIONS.has(name)),
)

const PROPS_DISPATCHING_SPECIFIERS = ['imp/html', ...STD_SPECIFIERS]

const ICONS_SPECIFIER = 'imp/icons'

const ICON_COUNT = Object.keys(iconsModule).length

const STATE_HELPERS = new Map([['initState', 1], ['useState', 1]])

const HTTP_CLIENT_HELPERS = new Map([
  ['createHttpClient', 0],
  ['initHttpClient', 1],
  ['useHttpClient', 1],
])

const STATE_HANDLE_CREATORS = new Set(['initState', 'useState', 'computed'])

const ROUTE_HANDLE_CREATORS = new Set(['useRoute'])

const READABLE_EXPORTS = new Map([
  ['imp/i18n', new Set(['lang', 'dir'])],
  ['imp/theme', new Set(['theme'])],
])

const WATCH_HOOKS = new Set(['setup', 'error', 'onMount'])

const SELF_NAME = 'self'

const propertyKeyName = (property) =>
  property.computed ? null : (property.key.name ?? property.key.value ?? null)

const firstParamName = (node) => {
  const first = node.params[0]
  return first?.type === 'Identifier' ? first.name : null
}

const DEFINITION_CALLS = new Map([
  ['imp', new Set(['component'])],
  ['imp/router', new Set(['router'])],
])

const createDefinitionTracker = () => {
  const locals = new Map()
  const namespaceLocals = new Set()
  const isDefinitionCallee = (callee) => {
    if (callee.type === 'Identifier') return locals.has(callee.name)
    const name = namespaceCalleeName(callee, namespaceLocals)
    return name !== null && [...DEFINITION_CALLS.values()].some((names) => names.has(name))
  }
  return {
    visitImport(node) {
      const names = DEFINITION_CALLS.get(node.source.value)
      if (!names) return
      collectImpImports(
        node,
        node.source.value,
        (name) => names.has(name) ? name : null,
        locals,
        namespaceLocals,
      )
    },
    isHook(node, hooks) {
      const property = node.parent
      if (property?.type !== 'Property' || property.value !== node) return false
      if (!hooks.has(propertyKeyName(property))) return false
      const definition = property.parent
      const call = definition?.parent
      return definition?.type === 'ObjectExpression' && call?.type === 'CallExpression' &&
        call.arguments.includes(definition) && isDefinitionCallee(call.callee)
    },
  }
}

const classifyFactory = (importedName) => {
  if (importedName === 'el') return 'el'
  if (ELEMENT_FACTORIES.has(importedName) || STD_COMPONENTS.has(importedName)) return 'tag'
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
    return `'${specifier}' must be an 'npm:' or 'jsr:' specifier (e.g. 'npm:mitt@3.0.1') - run 'imp install' to declare dependencies`
  }
  if (parsed.version && EXACT_VERSION.test(parsed.version)) return null
  const example = `${parsed.scheme}:${parsed.name}@${exampleVersion(parsed.version)}`
  const reason = parsed.version
    ? `'${parsed.version}' is not an exact version`
    : 'no version is given'
  return `'${specifier}' must pin an exact version (${reason}) - the vendored bundle in dependencies/ is built from this pin (e.g. '${example}'); run 'imp install' to re-resolve and re-pin it`
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

const createLiteralNameRule = ({ source, helpers, nameProblem }) => ({
  create(context) {
    const helperLocals = new Map()
    const namespaceLocals = new Set()
    const calls = []

    const calledHelper = (callee) => {
      if (callee.type === 'Identifier') return helperLocals.get(callee.name) ?? null
      const name = namespaceCalleeName(callee, namespaceLocals)
      return name !== null && helpers.has(name) ? name : null
    }

    return {
      ImportDeclaration(node) {
        collectImpImports(
          node,
          source,
          (name) => helpers.has(name) ? name : null,
          helperLocals,
          namespaceLocals,
        )
      },
      CallExpression(node) {
        calls.push(node)
      },
      'Program:exit'() {
        for (const node of calls) {
          const helper = calledHelper(node.callee)
          if (helper === null) continue
          const argument = node.arguments[helpers.get(helper)]
          const { known, name } = literalArgumentName(argument)
          if (!known) continue
          const problem = nameProblem(name)
          if (problem) context.report({ node: argument ?? node, message: problem })
        }
      },
    }
  },
})

const ANALYTICS_HELPERS = new Set(['zone', 'track'])

const ANALYTICS_SUBJECTS = new Map([['zone', 'zone'], ['track', 'outcome']])

const ANALYTICS_EXAMPLES = new Map([
  ['zone', 'myapp.invoice-summary'],
  ['track', 'myapp.invoice-sent'],
])

const analyticsNameArgument = (helper, node) => {
  const [first] = node.arguments
  if (helper === 'track') return { known: true, argument: first }
  if (first?.type !== 'ObjectExpression') return { known: false }
  if (first.properties.some((property) => property.type === 'SpreadElement')) {
    return { known: false }
  }
  const property = first.properties.find((entry) => propertyKeyName(entry) === 'name')
  return { known: true, argument: property?.value }
}

export const analyticsNameProblemOf = (helper, name) =>
  analyticsNameProblem(name, ANALYTICS_SUBJECTS.get(helper), ANALYTICS_EXAMPLES.get(helper))

export const createAnalyticsNameVisitor = (onName) => {
  const helperLocals = new Map()
  const namespaceLocals = new Set()
  const calls = []

  const calledHelper = (callee) => {
    if (callee.type === 'Identifier') return helperLocals.get(callee.name) ?? null
    const name = namespaceCalleeName(callee, namespaceLocals)
    return name !== null && ANALYTICS_HELPERS.has(name) ? name : null
  }

  return {
    ImportDeclaration(node) {
      collectImpImports(
        node,
        'imp/analytics',
        (name) => ANALYTICS_HELPERS.has(name) ? name : null,
        helperLocals,
        namespaceLocals,
      )
    },
    CallExpression(node) {
      calls.push(node)
    },
    'Program:exit'() {
      for (const node of calls) {
        const helper = calledHelper(node.callee)
        if (helper === null) continue
        const found = analyticsNameArgument(helper, node)
        if (!found.known) continue
        const { known, name } = literalArgumentName(found.argument)
        if (!known) continue
        onName({ helper, name, node: found.argument ?? node })
      }
    },
  }
}

const RESOLUTION_HELPERS = new Map([
  ['imp/state', new Set(['initState', 'useState'])],
  ['imp/http', new Set(['initHttpClient', 'useHttpClient'])],
])

const RESOLUTION_KINDS = new Map([
  ['initState', 'state'],
  ['useState', 'state'],
  ['initHttpClient', 'http client'],
  ['useHttpClient', 'http client'],
])

const RESOLUTION_EXAMPLES = new Map([
  ['initState', "initState(self, 'myapp.user', value)"],
  ['useState', "useState(self, 'myapp.user')"],
  ['initHttpClient', "initHttpClient(self, 'myapp.api', { baseUrl })"],
  ['useHttpClient', "useHttpClient(self, 'myapp.api')"],
])

const CLAIMING_HELPERS = new Set(['initState', 'initHttpClient'])

const LOADING_HELPERS = new Map([
  ['imp/state', new Set(['initState', 'useState'])],
  ['imp/http', new Set(['initHttpClient', 'useHttpClient'])],
  ['imp/router', new Set(['useRoute'])],
])

const HANDLE_CREATORS = new Map([
  ['imp/state', STATE_HANDLE_CREATORS],
  ['imp/router', ROUTE_HANDLE_CREATORS],
])

const BINDING_METHODS = new Set(['text', 'view', 'each', 'watch'])

const WATCH_METHOD = new Set(['watch'])

const GET_METHOD = new Set(['get'])

const SELF_HOOKS = new Set(['setup', 'error', 'onMount', 'onRemove'])

const RESOLVING_HOOKS = new Set(['setup', 'error'])

const SETUP_HOOK = new Set(['setup'])

const LOADING_HOOK = new Set(['loading'])

const SELF_FREE_ARGUMENT_TYPES = new Map([
  ['Literal', 'a literal'],
  ['TemplateLiteral', 'a template'],
  ['ObjectExpression', 'an object'],
  ['ArrayExpression', 'an array'],
  ['ArrowFunctionExpression', 'a function'],
  ['FunctionExpression', 'a function'],
])

const SELF_HOOKS_TEXT = 'self is the first parameter of setup, error, onMount and onRemove'

const ACCESSIBLE_NAME_FACTORIES = new Map([
  ['imp/html', new Map([['el', 'el'], ['img', 'img'], ['button', 'button']])],
  ['imp/std', new Map([['button', 'std-button'], ['icon', 'icon']])],
])

const IMG_ALT_KEYS = new Set(['alt'])

const EL_TAG_KINDS = new Map([['img', 'img'], ['button', 'button']])

const BUTTON_NAME_KEYS = new Map([
  ['button', new Set(['aria-label', 'ariaLabel', 'aria-labelledby', 'title'])],
  ['std-button', new Set(['label'])],
])

const BUTTON_NAME_EXAMPLES = new Map([
  ['button', "button({ 'aria-label': 'Delete' }, icon(luTrash))"],
  ['std-button', "button({ label: 'Delete' }, icon(luTrash))"],
])

const createAccessibleNameTracker = () => {
  const locals = new Map()
  const namespaces = new Map()
  const calleeKind = (callee) => {
    if (callee.type === 'Identifier') return locals.get(callee.name) ?? null
    if (
      callee.type !== 'MemberExpression' || callee.computed ||
      callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier'
    ) return null
    return namespaces.get(callee.object.name)?.get(callee.property.name) ?? null
  }
  return {
    visitImport(node) {
      const kinds = ACCESSIBLE_NAME_FACTORIES.get(node.source.value)
      if (!kinds) return
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportSpecifier') {
          const kind = kinds.get(importedName(specifier))
          if (kind) locals.set(specifier.local.name, kind)
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          namespaces.set(specifier.local.name, kinds)
        }
      }
    },
    element(node) {
      const kind = calleeKind(node.callee)
      if (kind !== 'el') return kind === null ? null : { kind, args: node.arguments }
      const { known, name } = literalArgumentName(node.arguments[0])
      const elKind = known ? EL_TAG_KINDS.get(String(name).toLowerCase()) : undefined
      return elKind ? { kind: elKind, args: node.arguments.slice(1) } : null
    },
    isIconCall(expression) {
      return expression.type === 'CallExpression' && calleeKind(expression.callee) === 'icon'
    },
  }
}

const propsObjectsOf = (args) => args.filter((argument) => argument.type === 'ObjectExpression')

const hasSpread = (objects) =>
  objects.some((object) => object.properties.some((property) => property.type === 'SpreadElement'))

const hasPropKey = (objects, keys) =>
  objects.some((object) =>
    object.properties.some((property) =>
      property.type === 'Property' && keys.has(propertyKeyName(property))
    )
  )

const ICON_NAME_KEYS = new Set(['label'])

const iconIsNamed = (call) => {
  const props = propsObjectsOf(call.arguments)
  return hasSpread(props) || hasPropKey(props, ICON_NAME_KEYS)
}

const createAccessibleNameRule = (check) => ({
  create(context) {
    const tracker = createAccessibleNameTracker()
    const calls = []
    return {
      ImportDeclaration: (node) => tracker.visitImport(node),
      CallExpression(node) {
        calls.push(node)
      },
      'Program:exit'() {
        for (const node of calls) {
          const element = tracker.element(node)
          if (element === null) continue
          const message = check(element, tracker)
          if (message) context.report({ node, message })
        }
      },
    }
  },
})

const createHelperTracker = (helpersBySource) => {
  const locals = new Map()
  const namespaceLocals = new Set()
  const allHelpers = new Set([...helpersBySource.values()].flatMap((names) => [...names]))
  return {
    visitImport(node) {
      const helpers = helpersBySource.get(node.source.value)
      if (!helpers) return
      collectImpImports(
        node,
        node.source.value,
        (name) => helpers.has(name) ? name : null,
        locals,
        namespaceLocals,
      )
    },
    calledHelper(callee) {
      if (callee.type === 'Identifier') return locals.get(callee.name) ?? null
      const name = namespaceCalleeName(callee, namespaceLocals)
      return name !== null && allHelpers.has(name) ? name : null
    },
  }
}

const createHandleTracker = () => {
  const creators = createHelperTracker(HANDLE_CREATORS)
  const names = new Set()
  const creatorOf = (expression) =>
    expression?.type === 'CallExpression' ? creators.calledHelper(expression.callee) : null
  const isHandleCall = (expression) => creatorOf(expression) !== null
  return {
    visitImport(node) {
      creators.visitImport(node)
      const readables = READABLE_EXPORTS.get(node.source.value)
      if (!readables) return
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportSpecifier' && readables.has(importedName(specifier))) {
          names.add(specifier.local.name)
        }
      }
    },
    visitDeclarator(node) {
      if (node.id.type === 'Identifier' && isHandleCall(node.init)) names.add(node.id.name)
    },
    visitAssignment(node) {
      if (node.operator === '=' && node.left.type === 'Identifier' && isHandleCall(node.right)) {
        names.add(node.left.name)
      }
    },
    handleText(expression) {
      if (expression.type === 'Identifier' && names.has(expression.name)) return expression.name
      const creator = creatorOf(expression)
      return creator === null ? null : `${creator}()`
    },
    methodCall(callee, methods) {
      if (
        callee.type !== 'MemberExpression' || callee.computed ||
        callee.property.type !== 'Identifier' || !methods.has(callee.property.name)
      ) return null
      const handle = this.handleText(callee.object)
      return handle === null ? null : { handle, method: callee.property.name }
    },
  }
}

const createFactoryTracker = () => {
  const locals = new Map()
  const namespaceLocals = new Set()
  return {
    visitImport(node) {
      for (const specifier of PROPS_DISPATCHING_SPECIFIERS) {
        collectImpImports(node, specifier, classifyFactory, locals, namespaceLocals)
      }
    },
    factoryKind(callee) {
      if (callee.type === 'Identifier') return locals.get(callee.name) ?? null
      const name = namespaceCalleeName(callee, namespaceLocals)
      return name === null ? null : classifyFactory(name)
    },
    factoryName(callee) {
      return callee.type === 'Identifier' ? callee.name : callee.property.name
    },
    childArguments(node) {
      const kind = this.factoryKind(node.callee)
      if (kind === null) return null
      return node.arguments.slice(kind === 'el' ? 1 : 0)
    },
  }
}

const createHookFrames = ({ hooks, inherit = true, describe }) => {
  const definitions = createDefinitionTracker()
  const frames = []
  const enter = (node) =>
    frames.push(definitions.isHook(node, hooks) ? describe(node) : (inherit ? frames.at(-1) : null))
  const exit = () => frames.pop()
  return {
    current: () => frames.at(-1) ?? null,
    visitImport: (node) => definitions.visitImport(node),
    visitors: {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': exit,
      FunctionExpression: enter,
      'FunctionExpression:exit': exit,
      ArrowFunctionExpression: enter,
      'ArrowFunctionExpression:exit': exit,
    },
  }
}

const selfNameOf = (node) => firstParamName(node) ?? SELF_NAME

const isSelfArgument = (argument, selfName) =>
  argument?.type === 'Identifier' && (argument.name === selfName || argument.name === SELF_NAME)

const isWatchCallee = (callee) =>
  callee.type === 'MemberExpression' && !callee.computed &&
  callee.property.type === 'Identifier' && callee.property.name === 'watch'

const isRootedAt = (expression, name) => {
  let current = expression
  while (current.type === 'MemberExpression') current = current.object
  return current.type === 'Identifier' && current.name === name
}

const rootIdentifier = (expression) => {
  let current = expression
  while (current.type === 'MemberExpression') current = current.object
  return current.type === 'Identifier' ? current : null
}

const isModuleScoped = (sourceCode, node, name) => {
  let scope = sourceCode.getScope(node)
  while (scope) {
    const variable = scope.set.get(name)
    if (variable) return scope.type === 'module' || scope.type === 'global'
    scope = scope.upper
  }
  return true
}

const isAbortSignalRead = (node, selfName) =>
  node.type === 'MemberExpression' && !node.computed &&
  node.property.type === 'Identifier' && node.property.name === 'abortSignal' &&
  node.object.type === 'Identifier' && node.object.name === selfName

const returnsPlainDom = (expression, factories, handles) => {
  if (expression === null) return true
  switch (expression.type) {
    case 'Literal':
    case 'TemplateLiteral':
      return true
    case 'ArrayExpression':
      return expression.elements.every((element) =>
        element !== null && element.type !== 'SpreadElement' &&
        returnsPlainDom(element, factories, handles)
      )
    case 'ConditionalExpression':
      return returnsPlainDom(expression.consequent, factories, handles) &&
        returnsPlainDom(expression.alternate, factories, handles)
    case 'CallExpression':
      return factories.factoryKind(expression.callee) !== null ||
        handles.methodCall(expression.callee, BINDING_METHODS) !== null
    default:
      return false
  }
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
              `'${name}' starts with a capital letter - imp components are lowercase functions (write '${
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
            for (const specifier of PROPS_DISPATCHING_SPECIFIERS) {
              collectImpImports(node, specifier, classifyFactory, factoryLocals, namespaceLocals)
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
                }' - pass a single props object; later keys win`,
              })
            }
          },
        }
      },
    },
    'state-name-namespace': createLiteralNameRule({
      source: 'imp/state',
      helpers: STATE_HELPERS,
      nameProblem: stateNameProblem,
    }),
    'http-client-name-namespace': createLiteralNameRule({
      source: 'imp/http',
      helpers: HTTP_CLIENT_HELPERS,
      nameProblem: httpClientNameProblem,
    }),
    'analytics-name-namespace': {
      create: (context) =>
        createAnalyticsNameVisitor(({ helper, name, node }) => {
          const problem = analyticsNameProblemOf(helper, name)
          if (problem) context.report({ node, message: problem })
        }),
    },
    'watch-with-self': {
      create(context) {
        const handles = createHandleTracker()
        const frames = createHookFrames({ hooks: WATCH_HOOKS, describe: selfNameOf })
        const calls = []
        return {
          ...frames.visitors,
          ImportDeclaration(node) {
            frames.visitImport(node)
            handles.visitImport(node)
          },
          VariableDeclarator: (node) => handles.visitDeclarator(node),
          AssignmentExpression: (node) => handles.visitAssignment(node),
          CallExpression(node) {
            const selfName = frames.current()
            if (!selfName || node.parent?.type !== 'ExpressionStatement') return
            calls.push({ node, selfName })
          },
          'Program:exit'() {
            for (const { node, selfName } of calls) {
              const call = handles.methodCall(node.callee, WATCH_METHOD)
              if (call === null || isSelfArgument(node.arguments[0], selfName)) continue
              context.report({
                node,
                message:
                  `'${call.handle}.watch' runs in a component without self, so nothing stops it when the component unmounts and the subscriber keeps running - pass self first (${call.handle}.watch(self, fn)), or keep the stop that watch(fn) returns and call it in onRemove`,
              })
            }
          },
        }
      },
    },
    'self-first-argument': {
      create(context) {
        const helpers = createHelperTracker(RESOLUTION_HELPERS)
        const calls = []
        return {
          ImportDeclaration: (node) => helpers.visitImport(node),
          CallExpression(node) {
            calls.push(node)
          },
          'Program:exit'() {
            for (const node of calls) {
              const helper = helpers.calledHelper(node.callee)
              if (helper === null) continue
              const [first] = node.arguments
              const given = first === undefined
                ? 'missing'
                : SELF_FREE_ARGUMENT_TYPES.get(first.type)
              if (given === undefined) continue
              context.report({
                node: first ?? node,
                message:
                  `'${helper}' takes self as its first argument, and here that argument is ${given} - write ${
                    RESOLUTION_EXAMPLES.get(helper)
                  }; ${SELF_HOOKS_TEXT}`,
              })
            }
          },
        }
      },
    },
    'no-self-in-loading': {
      create(context) {
        const helpers = createHelperTracker(LOADING_HELPERS)
        const handles = createHandleTracker()
        const frames = createHookFrames({ hooks: LOADING_HOOK, describe: () => true })
        const calls = []

        const bindingArguments = (node) =>
          node.arguments.flatMap((argument) =>
            argument.type === 'ObjectExpression'
              ? argument.properties.filter((property) => property.type === 'Property').map((
                property,
              ) => property.value)
              : [argument]
          )

        return {
          ...frames.visitors,
          ImportDeclaration(node) {
            frames.visitImport(node)
            helpers.visitImport(node)
            handles.visitImport(node)
          },
          VariableDeclarator: (node) => handles.visitDeclarator(node),
          AssignmentExpression: (node) => handles.visitAssignment(node),
          CallExpression(node) {
            if (frames.current()) calls.push(node)
          },
          'Program:exit'() {
            for (const node of calls) {
              const helper = helpers.calledHelper(node.callee)
              if (helper !== null) {
                context.report({
                  node,
                  message:
                    `'${helper}' runs in loading, which imp builds before the component mounts and without self, so the call throws - loading takes the factory arguments only; move the call into setup`,
                })
                continue
              }
              const bound = handles.methodCall(node.callee, BINDING_METHODS) ??
                bindingArguments(node).map((argument) => handles.handleText(argument)).find((
                  handle,
                ) => handle !== null)
              if (bound === undefined || bound === null) continue
              const subject = typeof bound === 'string' ? bound : `${bound.handle}.${bound.method}`
              context.report({
                node,
                message:
                  `'${subject}' binds state in loading, which imp builds before the component mounts, so the binding renders empty and never updates - pass a plain value here, and keep text, view, each, watch and a state-bound prop in setup`,
              })
            }
          },
        }
      },
    },
    'loading-with-async-setup': {
      create(context) {
        const factories = createFactoryTracker()
        const handles = createHandleTracker()
        const definitions = createDefinitionTracker()
        const frames = []
        const builds = []

        const enter = (node) =>
          frames.push(definitions.isHook(node, SETUP_HOOK) ? { node, returns: [] } : null)
        const exit = () => {
          const frame = frames.pop()
          if (frame) builds.push(frame)
        }

        return {
          FunctionDeclaration: enter,
          'FunctionDeclaration:exit': exit,
          FunctionExpression: enter,
          'FunctionExpression:exit': exit,
          ArrowFunctionExpression: enter,
          'ArrowFunctionExpression:exit': exit,
          ImportDeclaration(node) {
            definitions.visitImport(node)
            factories.visitImport(node)
            handles.visitImport(node)
          },
          VariableDeclarator: (node) => handles.visitDeclarator(node),
          AssignmentExpression: (node) => handles.visitAssignment(node),
          ReturnStatement(node) {
            frames.at(-1)?.returns.push(node.argument)
          },
          'Program:exit'() {
            for (const { node, returns } of builds) {
              if (node.async) continue
              const loading = node.parent.parent.properties.find((property) =>
                property.type === 'Property' && propertyKeyName(property) === 'loading'
              )
              if (!loading) continue
              const returned = node.body.type === 'BlockStatement' ? returns : [node.body]
              if (
                !returned.every((expression) => returnsPlainDom(expression, factories, handles))
              ) {
                continue
              }
              context.report({
                node: loading.key,
                message:
                  `loading is set, but setup returns synchronously, so imp swaps the loading content out before paint and nobody sees it - make setup async, or return a promise from it, or remove loading`,
              })
            }
          },
        }
      },
    },
    'on-remove-through-self': {
      create(context) {
        const helpers = createHelperTracker(RESOLUTION_HELPERS)
        const frames = createHookFrames({
          hooks: SELF_HOOKS,
          describe: (node) => ({
            hook: propertyKeyName(node.parent),
            definition: node.parent.parent,
            selfName: selfNameOf(node),
          }),
        })
        const resolved = new Map()
        const removals = []

        const resolvedIn = (definition) => {
          let entry = resolved.get(definition)
          if (!entry) {
            entry = { names: new Set(), open: false }
            resolved.set(definition, entry)
          }
          return entry
        }

        const selfStaysInside = (node, frame) => {
          const { parent } = node
          if (parent.type === 'MemberExpression') return true
          if (parent.type === 'Property' && parent.key === node && !parent.shorthand) return true
          if (
            parent.type === 'ArrowFunctionExpression' || parent.type === 'FunctionExpression' ||
            parent.type === 'FunctionDeclaration'
          ) return true
          if (parent.type === 'CallExpression' && parent.arguments[0] === node) {
            return helpers.calledHelper(parent.callee) !== null || isWatchCallee(parent.callee)
          }
          return frame.hook === 'onRemove'
        }

        const isClosedDefinition = (definition) =>
          definition.properties.every((property) => property.type === 'Property') &&
          definition.properties.some((property) =>
            propertyKeyName(property) === 'setup' &&
            (property.value.type === 'ArrowFunctionExpression' ||
              property.value.type === 'FunctionExpression')
          )

        return {
          ...frames.visitors,
          ImportDeclaration(node) {
            frames.visitImport(node)
            helpers.visitImport(node)
          },
          Identifier(node) {
            const frame = frames.current()
            if (!frame || !RESOLVING_HOOKS.has(frame.hook) || node.name !== frame.selfName) return
            if (!selfStaysInside(node, frame)) resolvedIn(frame.definition).open = true
          },
          CallExpression(node) {
            const frame = frames.current()
            if (!frame) return
            const helper = helpers.calledHelper(node.callee)
            if (helper !== null && isSelfArgument(node.arguments[0], frame.selfName)) {
              const { known, name } = literalArgumentName(node.arguments[1])
              const kind = RESOLUTION_KINDS.get(helper)
              if (RESOLVING_HOOKS.has(frame.hook)) {
                const entry = resolvedIn(frame.definition)
                if (known && name !== undefined) entry.names.add(`${kind}:${name}`)
                else entry.open = true
              } else if (frame.hook === 'onRemove') {
                removals.push({ node, helper, kind, known, name, definition: frame.definition })
              }
              return
            }
            if (
              frame.hook === 'onRemove' && isWatchCallee(node.callee) &&
              isSelfArgument(node.arguments[0], frame.selfName)
            ) {
              removals.push({ node, helper: 'watch', definition: frame.definition })
            }
          },
          'Program:exit'() {
            for (const removal of removals) {
              const { node, helper, kind, known, name, definition } = removal
              if (helper === 'watch') {
                context.report({
                  node,
                  message: `'${
                    context.sourceCode.getText(node.callee)
                  }(self, fn)' runs in onRemove, after the host has left the page, so nothing owns the subscription and the call throws - watch in setup, or hold the stop that watch(fn) returns`,
                })
                continue
              }
              if (CLAIMING_HELPERS.has(helper)) {
                context.report({
                  node,
                  message:
                    `'${helper}' runs in onRemove, after the host has left the page, so the call throws - initialize the ${kind} in setup, and reach it here with ${
                      helper === 'initState' ? 'useState' : 'useHttpClient'
                    }(self, name)`,
                })
                continue
              }
              const entry = resolvedIn(definition)
              if (
                !known || name === undefined || !isClosedDefinition(definition) || entry.open ||
                entry.names.has(`${kind}:${name}`)
              ) continue
              context.report({
                node: node.arguments[1],
                message:
                  `'${helper}' in onRemove reaches ${kind} '${name}', which setup never resolved - in onRemove, ${helper} returns only a handle that setup resolved through self, and a new name throws because the host has left the page; resolve '${name}' in setup, then reach it again here`,
              })
            }
          },
        }
      },
    },
    'no-self-at-module-scope': {
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode()
        const helpers = createHelperTracker(RESOLUTION_HELPERS)
        const frames = createHookFrames({ hooks: SELF_HOOKS, describe: selfNameOf })
        const assignments = []

        const carriesSelf = (expression, selfName) => {
          if (expression.type === 'Identifier' || expression.type === 'MemberExpression') {
            return isRootedAt(expression, selfName)
          }
          return expression.type === 'CallExpression' &&
            helpers.calledHelper(expression.callee) !== null &&
            isSelfArgument(expression.arguments[0], selfName)
        }

        return {
          ...frames.visitors,
          ImportDeclaration(node) {
            frames.visitImport(node)
            helpers.visitImport(node)
          },
          AssignmentExpression(node) {
            const selfName = frames.current()
            if (selfName && carriesSelf(node.right, selfName)) assignments.push({ node, selfName })
          },
          'Program:exit'() {
            for (const { node, selfName } of assignments) {
              const target = rootIdentifier(node.left)
              if (target === null || target.name === selfName) continue
              if (!isModuleScoped(sourceCode, node, target.name)) continue
              context.report({
                node,
                message: `'${
                  sourceCode.getText(node.left)
                }' at module scope stores what belongs to one mount - the module outlives every mount, so the next mount overwrites the value and an unmounted component stays reachable; store a per-mount resource on self instead (self.${
                  node.left.type === 'Identifier' ? node.left.name : 'field'
                } = ...)`,
              })
            }
          },
        }
      },
    },
    'abort-check-after-await': {
      create(context) {
        const helpers = createHelperTracker(RESOLUTION_HELPERS)
        const frames = createHookFrames({
          hooks: SETUP_HOOK,
          inherit: false,
          describe: (node) =>
            node.async
              ? {
                selfName: selfNameOf(node),
                awaited: false,
                checked: false,
                awaitDepth: 0,
                signalInAwait: false,
              }
              : null,
        })
        const reports = []

        return {
          ...frames.visitors,
          ImportDeclaration(node) {
            frames.visitImport(node)
            helpers.visitImport(node)
          },
          AwaitExpression() {
            const frame = frames.current()
            if (!frame) return
            if (frame.awaitDepth === 0) frame.signalInAwait = false
            frame.awaitDepth++
          },
          'AwaitExpression:exit'() {
            const frame = frames.current()
            if (!frame) return
            frame.awaitDepth--
            if (frame.awaitDepth > 0) return
            frame.awaited = true
            frame.checked = frame.signalInAwait
          },
          MemberExpression(node) {
            const frame = frames.current()
            if (!frame || !isAbortSignalRead(node, frame.selfName)) return
            if (frame.awaitDepth > 0) frame.signalInAwait = true
            else frame.checked = true
          },
          CallExpression(node) {
            const frame = frames.current()
            if (!frame || !frame.awaited || frame.checked) return
            const helper = helpers.calledHelper(node.callee)
            if (helper === null || !isSelfArgument(node.arguments[0], frame.selfName)) return
            reports.push({ node, helper })
          },
          'Program:exit'() {
            for (const { node, helper } of reports) {
              context.report({
                node,
                message:
                  `'${helper}' runs after an await in an async setup with no check of self.abortSignal - the component can leave the page while setup waits, and a resolution after that throws; test self.abortSignal.aborted after the await and return, pass self.abortSignal to the awaited call, or resolve before the first await`,
              })
            }
          },
        }
      },
    },
    'no-state-as-child': {
      create(context) {
        const factories = createFactoryTracker()
        const handles = createHandleTracker()
        const calls = []
        return {
          ImportDeclaration(node) {
            factories.visitImport(node)
            handles.visitImport(node)
          },
          VariableDeclarator: (node) => handles.visitDeclarator(node),
          AssignmentExpression: (node) => handles.visitAssignment(node),
          CallExpression(node) {
            calls.push(node)
          },
          'Program:exit'() {
            for (const node of calls) {
              const children = factories.childArguments(node)
              if (children === null) continue
              for (const child of children) {
                const handle = handles.handleText(child)
                if (handle === null) continue
                context.report({
                  node: child,
                  message: `'${handle}' is a state passed as a child of '${
                    factories.factoryName(node.callee)
                  }', and imp skips it - render it with ${handle}.text(), ${handle}.view(fn) or ${handle}.each(fn), or bind a prop with { class: ${handle} }`,
                })
              }
            }
          },
        }
      },
    },
    'no-get-in-binding': {
      create(context) {
        const factories = createFactoryTracker()
        const handles = createHandleTracker()
        const calls = []
        return {
          ImportDeclaration(node) {
            factories.visitImport(node)
            handles.visitImport(node)
          },
          VariableDeclarator: (node) => handles.visitDeclarator(node),
          AssignmentExpression: (node) => handles.visitAssignment(node),
          CallExpression(node) {
            calls.push(node)
          },
          'Program:exit'() {
            for (const node of calls) {
              const children = factories.childArguments(node)
              if (children === null) continue
              for (const argument of children) {
                if (argument.type !== 'ObjectExpression') continue
                for (const property of argument.properties) {
                  if (property.type !== 'Property') continue
                  const value = property.value
                  if (value.type !== 'CallExpression' || value.arguments.length > 0) continue
                  const call = handles.methodCall(value.callee, GET_METHOD)
                  if (call === null) continue
                  const key = propertyKeyName(property) ?? 'prop'
                  context.report({
                    node: value,
                    message: `'${call.handle}.get()' as the '${key}' prop of '${
                      factories.factoryName(node.callee)
                    }' copies the value once, and the prop never follows the state - pass the state itself: { ${key}: ${call.handle} }`,
                  })
                }
              }
            }
          },
        }
      },
    },
    'no-root-query-in-setup': {
      create(context) {
        const queryMethods = new Set(['querySelector', 'querySelectorAll', 'getElementById'])
        const definitions = createDefinitionTracker()
        const frames = []

        const hostSpecOf = (node) => {
          const first = node.params[0]
          if (!first) return null
          if (first.type === 'Identifier') return { kind: 'self', name: first.name }
          if (first.type === 'ObjectPattern') {
            for (const property of first.properties) {
              if (
                property.type === 'Property' && !property.computed &&
                property.key.type === 'Identifier' && property.key.name === 'host' &&
                property.value.type === 'Identifier'
              ) {
                return { kind: 'host', name: property.value.name }
              }
            }
          }
          return null
        }

        const isMember = (expression, name) =>
          expression.type === 'MemberExpression' && !expression.computed &&
          expression.property.type === 'Identifier' && expression.property.name === name

        const isHostExpression = (expression, spec) =>
          spec.kind === 'host'
            ? expression.type === 'Identifier' && expression.name === spec.name
            : isMember(expression, 'host') && expression.object.type === 'Identifier' &&
              expression.object.name === spec.name

        const isShadowRootExpression = (expression, spec) =>
          isMember(expression, 'shadowRoot') && isHostExpression(expression.object, spec)

        const enterFunction = (node) =>
          frames.push(definitions.isHook(node, SETUP_HOOK) ? hostSpecOf(node) : null)
        const exitFunction = () => frames.pop()

        return {
          ImportDeclaration: (node) => definitions.visitImport(node),
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
              isShadowRootExpression(callee.object, spec)
            ) {
              context.report({
                node,
                message:
                  `the shadow root is queried in setup before the returned DOM is placed - setup's output fills the shadow root only after setup returns (after the awaited promise resolves, for an async setup), so this finds the loading content, not your own; keep a reference to the node you build and use it directly, or query self.host.shadowRoot in onMount, which imp runs on the next frame once your DOM is laid out on the page`,
              })
            }
          },
        }
      },
    },
    'component-name': createLiteralNameRule({
      source: 'imp',
      helpers: new Map([['component', 0]]),
      nameProblem: componentNameProblem,
    }),
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
            if (!API_SPECIFIERS.includes(source)) return
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
                  `'${entry.name}' is not exported by '${entry.source}' - it comes from '${entry.home}': import { ${entry.name} } from '${entry.home}'`,
                fix: index === 0 ? (fixer) => moveSpecifier(fixer, entry) : undefined,
              })
            }
          },
        }
      },
    },
    'icons-by-name': {
      create(context) {
        const isIconsSource = (source) =>
          source?.type === 'Literal' && source.value === ICONS_SPECIFIER
        const wholeSet = (how) =>
          `${how} reaches for the whole 'imp/icons' set (${ICON_COUNT} icons) - the build drops only the icons an app never names, so import each one you draw: import { luHouse } from 'imp/icons'`
        return {
          ImportDeclaration(node) {
            if (!isIconsSource(node.source)) return
            const namespace = node.specifiers.find((specifier) =>
              specifier.type === 'ImportNamespaceSpecifier'
            )
            if (namespace) {
              context.report({
                node: namespace,
                message: wholeSet(`'import * as ${namespace.local.name}'`),
              })
            }
          },
          ExportAllDeclaration(node) {
            if (!isIconsSource(node.source)) return
            context.report({
              node,
              message: wholeSet(
                node.exported ? `'export * as ${node.exported.name}'` : `'export *'`,
              ),
            })
          },
          ImportExpression(node) {
            if (!isIconsSource(node.source)) return
            context.report({ node, message: wholeSet(`'import()'`) })
          },
        }
      },
    },
    'img-alt': createAccessibleNameRule(({ kind, args }) => {
      if (kind !== 'img') return null
      if (args.some((argument) => argument.type !== 'ObjectExpression')) return null
      const props = propsObjectsOf(args)
      if (hasSpread(props) || hasPropKey(props, IMG_ALT_KEYS)) return null
      return `'img' has no alt - a screen reader then reads the file name or nothing; describe the image in alt, or write alt: '' for an image that only decorates`
    }),
    'icon-button-name': createAccessibleNameRule(({ kind, args }, tracker) => {
      const nameKeys = BUTTON_NAME_KEYS.get(kind)
      if (!nameKeys) return null
      const children = args.filter((argument) => argument.type !== 'ObjectExpression')
      const unnamedIcon = (child) => tracker.isIconCall(child) && !iconIsNamed(child)
      if (!children.length || !children.every(unnamedIcon)) return null
      const props = propsObjectsOf(args)
      if (hasSpread(props) || hasPropKey(props, nameKeys)) return null
      return `'button' shows only an icon and has no accessible name - a screen reader announces it as "button" and nothing more; name the button itself: ${
        BUTTON_NAME_EXAMPLES.get(kind)
      }`
    }),
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
                `'${specifier}' is an inline dependency specifier - dependencies are vendored: run 'imp install ${installArg}' and import '${alias}' instead`,
            })
            return
          }
          if (
            isImpSpecifier(specifier) || isRelativeOrUrl(specifier) || aliases.has(specifier)
          ) return
          if (specifier.startsWith('imp/') && !aliases.has(specifier)) {
            context.report({ node, message: impSubpathProblem(specifier) })
            return
          }
          context.report({
            node,
            message:
              `'${specifier}' is not a declared dependency - run 'imp install ${specifier}' to vendor it and add it to 'dependencies' in imp.json`,
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
