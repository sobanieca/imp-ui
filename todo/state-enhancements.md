# State — enhancements

Named state (`initState`/`useState`, the subtree-scoped `StateSubscription` protocol, the
`{ get, set, update, on, text, view, each }` helper with automatic unmount cleanup, and the
`mergeStates` combinator) is implemented — see `adr/event-propagated-state.md`. This item collects
the follow-ups that were deliberately left out. (Batching was considered here and then **rejected**
— see `adr/event-propagated-state.md`; the docs cover the one-state and derived-display-state
patterns instead.)

## Reactive props

`text`, `view`, and `each` cover text, fragments, and lists; there is no reactive binding for
attributes, `class`, or `style` yet. Either grow dedicated helpers (`state.attr(...)`) or revisit
function-valued props in the renderer (`adr/type-based-argument-dispatch.md` would then say
"function argument means reactive"). Whatever form it takes should reuse the mount-scope cleanup
that `text`/`each` already have.
