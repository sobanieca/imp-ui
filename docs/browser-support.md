# Browser support

imp runs on the **current stable version of Chrome, Edge, Firefox and Safari**. That is the whole
policy. There is no support matrix, no minimum version to configure, and no separate build for an
older engine.

## What that means in practice

imp uses a web platform feature as soon as every major browser ships it. It does not wait two years.
Shadow DOM, `<dialog>`, the popover API and CSS anchor positioning all carry weight. They are how
the components of imp get their style isolation, their focus handling and their positioning.

The trade is deliberate. imp calls the platform for these jobs instead of writing them again. So a
modal traps the focus the way that your browser traps focus. A drop-down is positioned by the layout
engine of your browser. An overlay stacks correctly above another overlay, and imp keeps no registry
of what is on top. None of that behaviour is imp code that can disagree with your browser, and none
of it is code that you ship to your users.

The cost is that **imp does not degrade on an older browser. It breaks.** There is no fallback path,
because a fallback path is a second implementation, and a second implementation is what this policy
exists to avoid. If your audience uses a browser older than the current stable version, imp is not
the correct choice for that project. It is better to learn that here than in a bug report.

Usually you do not think about this. A browser updates itself, and the floor moves with it.

## Where you can see the policy

Today the one visible place is **Firefox ESR**, the extended-support release that an enterprise pins
to. The ESR line runs behind mainline Firefox by design. The branch that is supported through
September 2026 is older than CSS anchor positioning. On that branch, a component that positions a
panel next to a trigger opens in the wrong place. This covers a drop-down menu, a tooltip and a
popover. The next ESR branch corrects it.

Every gap has this shape. It is temporary, it closes when the browser that is behind catches up, and
imp carries no code to hide it in the meantime.

## What imp does not build

The same policy applies to what the standard component library ships. imp does not ship a component
that it cannot build on platform behaviour without writing again something that the browser already
does. It tells you what to use instead.

The clearest example is a virtualized list. To window a long list in JavaScript, you take the
scrolling, the measurement and the rendering from the browser. That is a large amount of code, and
it approximates a job that the browser does natively. imp does not ship such a list. It points you
at `content-visibility: auto` with `contain-intrinsic-size`, which is CSS and does the same work.

A component with **no** platform counterpart is a different case, and it is in scope. A combo box, a
date picker and a tree view replace nothing, because the platform has no such control. imp builds
those.
