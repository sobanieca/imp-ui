import { component } from '../../component.js'
import { splitArgs, warnUnknownProps } from './args.js'

const tagFor = (name) => `imp-${name.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`)}`

const defined = {}

const define = (name, createDefinition, onFirstUse) => {
  onFirstUse?.()
  const { props: knownProps, styles, build, ...rest } = createDefinition()
  return component(tagFor(name), {
    ...rest,
    styles: styles?.(),
    build: (instance, ...args) => {
      const { props, children } = splitArgs(name, args)
      warnUnknownProps(name, props, knownProps)
      return build(instance, props, children)
    },
  })
}

export const defineComponent = (name, createDefinition, onFirstUse) =>
  defined[name] ??= define(name, createDefinition, onFirstUse)
