# Mobile preview scroll - widen the whole scenario panel, not only the stage

On a phone the vertical scenario tabs leave the panel of a scenario about 230px wide. Today only the
stage grows. `STAGE_STYLES` in `cli/src/preview-runtime.js` makes `.viewport` a size container, and
a container query under `20rem` sets `.frame` to `inline-size: 200%`. The frame overflows the panel,
and `.scroll` in `cli/src/preview-shell.js` scrolls sideways, so a swipe moves the tabs out of view.
This works, but the rest of the panel stays at the narrow width. The code panel under the stage, the
scenario head with its two toggles, and the failure block keep 230px. So the page shows a wide stage
over a narrow code block, and the code block scrolls inside itself while the stage scrolls with the
page.

## What to build

Widen the whole content of the scenario panel on a narrow panel, and leave the desktop as it is.

- Move the rule up one level. Make the `section.scenario` the size container, and put the content of
  the section in one child that the query widens: head, stage, code panel and failure block. The
  section keeps the panel width, so the container query still measures the panel. The child takes
  `inline-size: 200%` and overflows into the canvas, the same way the frame does today.
- Remove the stage-level rule. `.viewport` and the `@container` block in `STAGE_STYLES` go away. The
  frame is `100%` of its parent again, and it is twice the panel because its parent is.
- Keep the breakpoint at `20rem`. The measured panel is 376px in an 800px window and 223px on a
  390px phone, so `20rem` separates the two.
- Keep the dialog anchored to the toggle. The toggle moves with the head, and the anchor follows.

Decide whether the head must grow. A wider head puts the state and code toggles further from the
left edge, where a thumb rests. An option is to keep the head at the panel width and to widen only
the stage and the code panel. Try both on a phone before you choose.

## What to update with it

- `cli/test/cli-test.js`: `stageWidths` measures `.viewport` and `.frame`. Measure the widened child
  and the code block instead. The snapshot line in `cli/test/snapshots/preview-browser.txt` that
  starts with `stage width as % of its panel` changes with it.
- `docs/cli.md`, the paragraph under "The stage" that starts with "On a phone".
- `skills/preview.md`, the "Stage" bullet.
- `adr/component-preview.md`, the "A scenario panel is a stage, a code panel and a state editor"
  bullet.
