# Browser support

imp runs on the **current stable version of Chrome, Edge, Firefox and Safari**. That is the whole
policy. There is no support matrix, no minimum version to configure, and no separate build for older
engines.

## What that means in practice

imp uses a web platform feature as soon as every major browser has shipped it - not two years later.
Shadow DOM, `<dialog>`, the popover API and CSS anchor positioning are all load-bearing: they are
how imp's components get their styling isolation, their focus handling, and their positioning.

The trade is deliberate. Because imp calls the platform for these things instead of reimplementing
them, a modal traps focus the way your browser traps focus, a dropdown is positioned by your
browser's layout engine, and an overlay stacks correctly above another overlay without imp keeping a
registry of what is on top. None of that behaviour is imp code that can disagree with your browser,
and none of it is code you are shipping to your users.

The cost is that **imp does not degrade on an older browser - it breaks.** There is no fallback
path, because a fallback path is a second implementation, and a second implementation is the thing
this policy exists to avoid. If your audience includes browsers older than current stable, imp is
not the right choice for that project, and it is better to know that here than to find it in a bug
report.

In the ordinary case this is not something you will think about. Browsers update themselves, and the
floor moves with them.

## Where you might notice it

The one place the policy is visible today is **Firefox ESR**, the extended-support release
enterprises pin to. The ESR line runs behind mainline Firefox by design, and the branch supported
through September 2026 predates CSS anchor positioning. On it, components that position a panel next
to a trigger - dropdown menus, tooltips, popovers - open in the wrong place. The following ESR
branch resolves it.

This is the general shape of any gap: it is temporary, it closes when the lagging browser catches
up, and imp does not carry code to paper over it in the meantime.

## What imp will not build

The same policy applies to what ships in the standard component library. If a component cannot be
built on platform behaviour without reimplementing something the browser already does, imp does not
ship that component - it tells you what to use instead.

The clearest example is a virtualized list. Windowing a long list in JavaScript means taking over
scrolling, measurement and rendering from the browser, which is a large amount of code doing an
approximation of a job the browser does natively. Instead of shipping one, imp points you at
`content-visibility: auto` with `contain-intrinsic-size`, which is CSS and does the same work.

Components that have **no** platform counterpart are a different case and are in scope: a combo box,
a date picker and a tree view are not substitutes for anything, because the platform has no such
control. imp builds those.
