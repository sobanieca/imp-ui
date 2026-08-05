import { component } from '../../component.js'
import { splitArgs, warnUnknownProps } from './args.js'

export const tagFor = (name) =>
  `imp-${name.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`)}`

const defined = {}

const define = (name, build, onFirstUse) => {
  onFirstUse?.()
  const { props: knownProps, styles, onMount, ...rest } = build()
  return component(tagFor(name), {
    ...rest,
    styles: styles?.(),
    onMount: (instance, ...args) => {
      const { props, children } = splitArgs(name, args)
      warnUnknownProps(name, props, knownProps)
      return onMount(instance, props, children)
    },
  })
}

export const defineComponent = (name, build, onFirstUse) =>
  defined[name] ??= define(name, build, onFirstUse)
