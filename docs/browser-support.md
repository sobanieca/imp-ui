# Browser support

imp runs on the **current stable version of Chrome, Edge, Firefox, and Safari**. That is the whole
policy. There is no support matrix, no minimum version to configure, and no separate build for an
older engine.

## What that means in practice

imp uses a web platform feature as soon as every major browser ships it. It does not wait for years.
Shadow DOM, `<dialog>`, the popover API, and CSS anchor positioning all carry weight: they give the
components of imp their style isolation, their focus handling, and their positioning.

The trade is deliberate. imp calls the platform for these jobs instead of writing them again. A
modal traps focus the way your browser traps focus. A drop-down is positioned by your browser's
layout engine. An overlay stacks correctly above another overlay, with no registry of what is on top
inside imp. None of that behavior is imp code that can disagree with your browser, and none of it is
code you ship to your users.

The cost is that **imp does not degrade on an older browser. It breaks.** There is no fallback path,
because a fallback path is a second implementation, and this policy exists to avoid a second
implementation. If your audience uses a browser older than the current stable version, imp is not
the right choice for that project. It is better to learn that now than from a bug report.

Usually you do not need to think about this. A browser updates itself, and the floor moves with it.

## Where you can see the policy

Today the one visible case is **Firefox ESR**, the extended-support release an enterprise pins to.
The ESR line runs behind mainline Firefox by design. The branch supported through September 2026 is
older than CSS anchor positioning. On that branch, a component that positions a panel next to a
trigger, such as a drop-down menu, a tooltip, or a popover, opens in the wrong place. The next ESR
branch corrects it.

Every gap has this shape: it is temporary, it closes when the browser that is behind catches up, and
imp carries no code to hide it in the meantime.

## What imp does not build

The same policy shapes the standard component library. imp does not ship a component it cannot build
on platform behavior, without writing again something the browser already does. Instead, it tells
you what to use.

The clearest example is a virtualized list. To window a long list in JavaScript, you take scrolling,
measurement, and rendering away from the browser. That is a large amount of code, and it only
approximates a job the browser already does natively. imp does not ship such a list. The rows of
`list`, and the cards of `table` on a narrow screen, carry `content-visibility: auto` with a
`contain-intrinsic-block-size`. So the browser skips the layout and the paint of the rows outside
the viewport, and the list costs what is on screen. A row of a `<table>` cannot skip its rendering,
because containment does not apply to a table row. So a `table` with thousands of rows pages them
with `hasMore` and `onLoadMore`. In a component of your own, put the same two declarations on each
row.

A component with **no** platform counterpart is a different case, and it is in scope. A combo box, a
date picker, and a tree view replace nothing, because the platform has no such control. imp builds
those.
