# Translatable by default — `<html lang>` is the language, messages are plain objects

## Context

Every app that outgrows one language needs three things: somewhere to put the strings, a way to look
one up, and a notion of "the current language". The usual answer is a library that brings its own
store, its own reactive layer, its own message format, and a family of formatting helpers — `t`,
plus wrappers for numbers, dates, relative time and plural selection, plus setters for the active
and fallback locale. imp already owns the reactive half: a state graph with fine-grained text
bindings (`event-propagated-state.md`). What it lacked was a place to keep the current language.

The formatting half is deliberately **out of scope for this decision**. Number, date and plural
rules are locale data with real subtlety, and a wrong abstraction over them is worse than none — so
this ADR covers lookup and lifetime only, and leaves formatting to the app, which can reach for the
platform's `Intl` directly.

The web platform already has the missing place.

`<html lang>` is the standard declaration of a document's language: it drives `:lang()` in CSS,
hyphenation, spellcheck and screen-reader pronunciation, and it is observable through
`MutationObserver`. Inventing a second, imp-private notion of "current locale" beside it would leave
two sources of truth that have to be kept in step by hand.

## Decision

i18n ships as **three names on `imp/i18n`** — `t`, `lang`, `setLang` — plus a `translations` option
on `init` and on `area`. There is deliberately **no public register call**: an app declares its
languages where it declares everything else about itself, and imp owns loading and dropping them.
The whole module is built on the DOM and plain objects — it uses no `Intl` and carries no locale
data of its own.

- **`<html lang>` is the language.** `lang.get()` and `t()` read the attribute on every call, so
  they can never disagree with the document. `setLang(code)` writes it — and only it; writing the
  attribute by any other means works identically, because a `MutationObserver` on it feeds imp's
  state and triggers the same load. When the attribute is unset, `navigator.language` is used, so an
  app that declares its languages and never calls `setLang` already serves the visitor's preferred
  language.

- **Translations are declared, not registered — and only the active language is loaded.** `init` and
  `area` both take `translations` as a **map of language code to loader**, and imp calls exactly one
  of them: the entry matching the current language (plus its base language, so `en-GB` can be a
  handful of overrides rather than a full copy of `en`). `init` loads before the app mounts, an area
  loads before its first screen paints, so nothing ever paints untranslated. This is why `setLang`
  is **async**: switching language means loading every live scope's messages for the target
  language, and only then writing the attribute and dropping the previous ones, which makes the
  switch atomic from the DOM's point of view. A loader is a dynamic `import()` of the file and
  nothing else: one way to write it, one thing for the bundler to split, and no second loading
  mechanism to document or explain.
- **`lang` is a read-only state**, the same shape `theme` has (`themable-by-default-tokens.md`), so
  `lang.text(() => t('todo.title'))` re-localizes one text node in place — no re-render, and no
  reactive machinery invented for i18n.
- **A language's messages are a plain nested object**, written and imported like any other module.
  Messages loaded later shadow earlier ones key by key, so an area can override a message the app
  defines. `t('todo.title')` walks the dot path to a **string**; an object at the end of that path
  is a group, and naming one is an error.
- **A message is looked up and interpolated, never selected between.** `t(key, params)` takes an
  optional plain object of `{name}` placeholder values, substituted with `String(value)`; an
  unmatched placeholder is left in the output rather than blanked, so a typo is visible. There is no
  plural selection, no number or date formatting, and no locale-aware anything: those are the app's
  to do, with `Intl` if it wants. This is a **deliberate v1 boundary** — the alternative was
  inventing conventions (a magic `count` param, a forms-object shape) whose failure modes are silent
  wrong grammar or a raw key, which is a poor trade for a feature an app can express itself.
- **What is loaded is a stack of layers, and each is individually removable.** Messages are not
  merged into one object; every load pushes a layer, and lookup walks the layers newest-first,
  taking the first that resolves the whole dot path. That gives the same result as a deep merge for
  every lookup — a partial override still falls through to the layer beneath it for keys it does not
  carry — while remaining reversible, which a destructive merge is not. Dropping a scope removes
  exactly the layers it added.
- **An area's messages live exactly as long as the area.** The router owns the lifetime
  (`client-side-router.md`): it loads the area's messages on entry and drops them through the route
  page's own cleanup on exit, the same unmount that releases the section's DOM and state. App code
  writes no lifecycle for it. Dropping removes them from lookups; it does not free memory, because
  the module holding them stays in the browser's registry for the life of the page, exactly as an
  area's code does. The win is in what is **downloaded** — a section never visited, or a language
  never selected, is never downloaded — and in keeping a section's keys from resolving outside it.
  Areas are expected to namespace their messages under their own top-level key; imp cannot warn
  about a collision, because a later layer shadowing an earlier one is also how an area deliberately
  overrides an app-level message.
- **Fallback is a fixed rule, not a setting:** exact code → base language (`en-GB` → `en`) → the
  first language declared → the key itself. Because only the active language is resident, this chain
  does not reach another language's text: a key missing from the active language renders as the key,
  which is the price of never holding a language nobody is reading. A key that cannot be resolved,
  and a group named where a message was expected, are reported once through the built-in logger
  (`built-in-logger.md`) and render as the key, so a missing translation degrades to a visible,
  greppable string instead of an exception.

## Consequences

- The whole subject is three names, no dependency and no locale data; the message format is "a JS
  object of strings", so there is nothing to learn, generate or compile, and a language's messages
  can be split across files, lazily imported or built at runtime like any other value.
- An app declares its languages once, in `init` and in each `area`, and never writes loading or
  teardown code: what is downloaded, when, and what is dropped all follow from where it was
  declared. The cost is that `setLang` is async, so a switch is `await setLang(code)`.
- Apps that never switch language at runtime can ignore all of it and reload the page instead —
  `init({ lang })` starts in whichever language was chosen. Live switching is the same feature with
  the strings bound through `lang`, which is the rule the standard components follow so they
  re-localize in place.
- Because the attribute is the source of truth, a value read is always current, while notification
  of an _external_ write costs one microtask (`MutationObserver` timing). Code that switches
  language through `setLang` sees both synchronously.
- **What imp does not do yet, and knows it:** plural selection, number and date formatting, relative
  time, and deriving the document's `dir` for right-to-left languages. Each needs `Intl` and a set
  of conventions worth designing on their own; an app that needs one today writes it against
  `lang.get()`. Nothing in this decision blocks adding them later — `t()` returning a plain string
  is a floor, not a ceiling.
