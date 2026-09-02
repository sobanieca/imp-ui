# Translatable by default - `<html lang>` is the language, `<html dir>` follows it, messages are plain objects

## Context

Every app that grows past one language needs three things. It needs a place to put the strings. It
needs a way to look one up. It needs a notion of "the current language". The usual answer is a
library that brings its own store, its own reactive layer, its own message format, and a family of
helpers for formatting. That family holds `t`, plus a wrapper for a number, a date, a relative time
and the selection of a plural, plus a setter for the active locale and for the fallback locale. imp
already owns the reactive half, which is a graph of states with fine-grained bindings for text, see
`event-propagated-state.md`. What imp lacked was a place to keep the current language.

The half about formatting is deliberately **out of scope for this decision**. The rules for a
number, a date and a plural are locale data with real subtlety. A wrong abstraction over them is
worse than none. So this ADR covers the lookup and the lifetime only. It leaves the formatting to
the app, which can use the `Intl` object of the platform directly.

The web platform already has the missing place.

`<html lang>` is the standard declaration of the language of a document. It drives `:lang()` in CSS,
hyphenation, the spell check, and the pronunciation of a screen reader. A `MutationObserver` can
also observe it. To invent a second, private notion of "the current locale" beside that attribute
would leave two sources of truth, and somebody would keep them in step by hand.

## Decision

The i18n subject ships as **six names on `imp/i18n`**. Those are `t`, `lang`, `dir`, `setLang`,
`missingMessages` and `defaultMessages`. It also adds the `translations` and `dir` options on
`init`, and the `translations` option on `area`. There is deliberately **no register call for the
translations of a language**. An app declares its languages where it declares everything else about
itself, and imp owns the load and the drop. `defaultMessages` is not that call. It registers the
**fallback wording of a component**, which belongs to the component, and not to any language that
the app declares. See below. The whole module is built on the DOM and on plain objects. It carries
no locale data of its own. The one API of the platform that it uses is `Intl.Locale`, to read the
writing direction of a language.

- **`<html lang>` is the language.** `lang.get()` and `t()` read the attribute on every call. So
  they can never disagree with the document. `setLang(code)` writes the attribute, and it writes
  nothing else. To write the attribute in another way works in the same manner, because a
  `MutationObserver` on it feeds the state of imp, and starts the same load. When the attribute is
  not set, imp uses `navigator.language`. So an app that declares its languages, and that never
  calls `setLang`, already serves the preferred language of the visitor.

- **`<html dir>` is the direction, and imp derives it from the language.** The direction is not a
  second thing to configure. Wherever imp writes `lang`, it writes `dir`. imp resolves the direction
  through `Intl.Locale#getTextInfo()`. So it follows the **script**, and not a list of right-to-left
  languages that somebody keeps by hand. `az-Arab` is RTL, and `az-Latn` is not. imp keeps a small
  set of base languages as a fallback, for an engine that is older than the API. `init` applies the
  direction, with or without a language. So the attribute is always present before the app mounts,
  and content that imp renders never paints in the wrong direction. `dir` is a read-only state, of
  the same shape as `lang`. An app that needs a fixed direction, whatever the language, pins it with
  `init({ dir })`. That pin then wins against the derivation, for the life of the app. A _part_ of a
  page that needs its own direction uses the `dir` attribute on that element. Text whose direction
  depends on its content uses the `dir="auto"` of the platform. Neither one needs anything from imp.
  imp respects a `<html dir>` that somebody writes by hand, until the language next changes. At that
  point the derivation takes over again, because the language is the input, and a change of language
  is what recomputes the direction. It follows that **imp writes its own styles in logical
  properties**, such as `padding-inline` and `text-align: start`. To set the attribute is worthless
  when the components under it are fixed to one direction.

- **The words of a component work in the way that its design tokens work.** A component reads its
  colours from `var(--imp-color-text, #0f172a)`. That is the value of the app, when the theme
  defines one, and a built-in fallback when it does not. Text that the app must not invent has the
  same shape. Examples are `No results`, `Cancel` and `Rows per page`. imp looks that text up
  through `t()`, under a key with an `imp.` prefix. The component **declares its own English
  wording** for the keys that it reads, through `defaultMessages`. That is a flat map, from a dotted
  key to a string, and the component registers it where it defines its element. So a module that
  nobody renders stays free of a side effect, see `standard-component-library.md`. A translation of
  the key by an app shadows that wording, per key and per language, in the way that a token
  overrides a fallback. The prefix is a namespace, and not a mechanism. Nothing in the lookup treats
  `imp.` specially. It keeps the keys of the library clear of the keys of the app, exactly as
  `--imp-*` does for a token.

  imp rejects a **catalog of languages inside the library**. That would make imp ship a chunk per
  language, whether or not somebody reads the app in that language. It would also put imp in the
  business of maintaining a translation for every language that it guesses at. One English string,
  beside the component that reads it, has neither cost. It ships only when that component ships. It
  is one line in the file that is already open. It selects a register only in the one language that
  the authors of imp can check. Is it _Delete_ or _Remove_? Is it _OK_ or _Got it_? It is a
  fallback, and an app overrides it key by key. The alternative for a key with no translation was to
  render `imp.state.empty` to a reader, and that is worse than English wording in a Polish page. imp
  accepts one cost. A key with no translation is no longer loud. imp reports it through the logger,
  at **debug** level, because an app that leans on the built-in wording on purpose makes no mistake.
  `missingMessages()` returns the declared keys that the active language does not translate, for an
  app that wants to check its coverage. A key with no default wording still gives a warning, and
  renders as itself.

- **An app declares a translation. It does not register one. imp loads the active language only.**
  `init` and `area` both take `translations` as a **map of a language code to a loader**. imp calls
  exactly one loader. That is the entry that matches the current language, with the entry of its
  base language. So `en-GB` can be a few overrides, in place of a full copy of `en`. `init` loads
  before the app mounts. An area loads before its first screen paints. So nothing ever paints
  untranslated. That is why `setLang` is **async**. To change the language means to load the
  messages of every live scope, for the target language. Only then does imp write the attribute, and
  drop the previous messages. So the change is atomic, from the point of view of the DOM. A loader
  is a dynamic `import()` of the file, and nothing else. There is one way to write it, one thing for
  the bundler to split, and no second mechanism of loading to document or to explain.
- **`lang` is a read-only state**, of the same shape as `theme`, see
  `themable-by-default-tokens.md`. So `lang.text(() => t('todo.title'))` localizes one text node
  again, in place. Nothing renders again, and nobody invented reactive machinery for i18n.
- **The messages of a language are a plain nested object.** Somebody writes them, and imports them,
  like any other module. A set of messages that loads later shadows an earlier set, key by key. So
  an area can override a message that the app defines. `t('todo.title')` walks the dotted path to a
  **string**. An object at the end of that path is a group, and to name a group is an error.
- **imp looks a message up, and interpolates it. It never selects between two messages.**
  `t(key, params)` takes an optional plain object of values for a `{name}` placeholder. imp
  substitutes each one with `String(value)`. imp leaves a placeholder with no match in the output,
  and does not blank it. So a spelling mistake is visible. There is no selection of a plural, no
  formatting of a number or a date, and nothing that depends on a locale. Those belong to the app,
  which can use `Intl`. That is a **deliberate boundary of version 1**. The alternative was to
  invent a convention, such as a magic `count` parameter, or the shape of an object of forms. The
  failure modes of such a convention are wrong grammar with no message, or a raw key. That is a poor
  trade for a feature that an app can express itself.
- **What imp loads is a stack of layers, and it can remove each one on its own.** imp does not merge
  the messages into one object. Every load pushes a layer. A lookup walks the layers, from the
  newest to the oldest, and takes the first layer that resolves the whole dotted path. That gives
  the same result as a deep merge, for every lookup. A partial override still falls through to the
  layer below it, for a key that it does not carry. It also stays reversible, and a destructive
  merge is not. To drop a scope removes exactly the layers that it added.
- **The messages of an area live exactly as long as the area.** The router owns the lifetime, see
  `client-side-router.md`. It loads the messages of the area on entry. It drops them through the
  cleanup of the route page on exit, which is the same unmount that releases the DOM and the state
  of the section. App code writes no lifecycle for that. To drop the messages removes them from a
  lookup. It does not free memory, because the module that holds them stays in the registry of the
  browser, for the life of the page, exactly as the code of an area does. The gain is in what imp
  **downloads**. A section that nobody visits, and a language that nobody selects, are never
  downloaded. The other gain is that the keys of a section stop resolving outside it. imp expects an
  area to put its messages under a top-level key of its own. imp cannot warn about a collision,
  because a later layer that shadows an earlier one is also how an area overrides a message of the
  app on purpose.
- **The fallback is a fixed rule, and not a setting.** The chain is the exact code, then the base
  language, so `en-GB` falls to `en`, then the first language that the app declared, then the
  default wording of the key, then the key itself. imp holds the active language only. So this chain
  does not reach the **translations** of another language. A key that the active language lacks
  falls to the wording that its component declared, or to the key. That is the price of never
  holding a language that nobody reads. imp reports a key that it cannot resolve, and a group that
  it found where it expected a message, once, through the built-in logger, see `built-in-logger.md`.
  So a missing translation becomes readable text, or a visible string that somebody can search for,
  and not an exception.

## Consequences

- The whole subject is six names, with no dependency and no locale data. The message format is a
  JavaScript object of strings. So there is nothing to learn, to generate or to compile. The
  messages of a language can also be split across files, imported lazily, or built at runtime, like
  any other value.
- An app declares its languages once, in `init` and in each `area`. It never writes code for loading
  or for teardown. What imp downloads, when it downloads it, and what it drops, all follow from the
  place where the app declared the language. The cost is that `setLang` is async. So a change is
  `await setLang(code)`.
- An app that never changes language at runtime can ignore all of that, and reload the page instead.
  `init({ lang })` starts in whichever language somebody chose. A change in place is the same
  feature, with the strings bound through `lang`. That is the rule that the standard components
  follow, so they localize again in place.
- The attribute is the source of truth. So a value that you read is always current. A notification
  about a write from **outside** costs one microtask, because of the timing of a `MutationObserver`.
  Code that changes the language through `setLang` sees both parts synchronously.
- Support for right to left costs an app nothing that it would not do anyway. Declare the
  translations, write logical CSS, and the layout follows the reader. The cost is that imp writes
  `<html dir>`. An app that wants a different value pins it. It does not fight for the attribute.
- imp carries no locale data. It carries no wording beyond one English string per key that a
  component of imp reads. So a build contains exactly the languages that the app wrote, plus the
  words of the components that it renders. An app that translates nothing still reads correctly. An
  app that translates everything ships nothing extra that is worth measuring. The cost is that a
  forgotten translation is invisible to a reader of English. `missingMessages()` reports it when you
  ask. The list of keys of a component also stays small, and it grows only when the component really
  needs a word.
- **imp does not do these things yet, and it knows that.** It does not select a plural. It does not
  format a number or a date. It does not format a relative time. Each one needs `Intl`, and a set of
  conventions that somebody must design on its own. An app that needs one today writes it against
  `lang.get()`. Nothing in this decision blocks the addition of one later. A `t()` that returns a
  plain string is a floor, and not a ceiling.
