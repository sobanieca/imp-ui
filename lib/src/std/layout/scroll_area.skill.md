# scrollArea - a region that scrolls on its own instead of growing the page

```js
import { scrollArea } from 'imp/std/layout'

scrollArea({ maxHeight: '24rem', label: 'Activity' }, ...entries)
```

Call shape: `scrollArea(props?, ...children)` - the props object, when present, must be the
**first** argument; everything after it is the scrolling content.

| Prop        | Values                                    | Default      | Notes                                 |
| ----------- | ----------------------------------------- | ------------ | ------------------------------------- |
| `axis`      | `'vertical'`, `'horizontal'`, `'both'`    | `'vertical'` | Which way it may scroll               |
| `maxHeight` | CSS length, e.g. `'24rem'`                | none         | When to start scrolling down the page |
| `maxWidth`  | CSS length, e.g. `'40rem'`                | none         | When to start scrolling across        |
| `label`     | string, or a state holding one - **live** | -            | Names the region for screen readers   |
| `hideBelow` | `'sm'`, `'md'`, `'lg'`, `'xl'`            | -            | Hidden under that width               |
| `hideAbove` | `'sm'`, `'md'`, `'lg'`, `'xl'`            | -            | Hidden from that width up             |

**`maxHeight`, `maxWidth`, `hideBelow` and `hideAbove` are responsive**: pass one value, or a
per-breakpoint object such as `maxHeight: { xs: '12rem', md: '30rem' }`. Breakpoints: `xs` from 0,
`sm` from 40rem, `md` from 48rem, `lg` from 64rem, `xl` from 80rem.

Rules an agent gets wrong:

- **Nothing scrolls without a bound.** With no `maxHeight` (or no height from its parent) the region
  grows and the page scrolls instead. `axis` alone does nothing.
- **`maxHeight` is a CSS length string, not a spacing step** - `'24rem'`, not `24`.
- **Give it a `label` whenever it holds meaningful content.** The region is keyboard-focusable so it
  can be scrolled without a mouse, and a focusable region with no name is announced as nothing.
- **It clips, so overlays inside it get cut off.** Tooltips and menus belong outside the scroll
  area.
- Unknown props warn at mount, and an out-of-range `axis` warns and falls back.

```js
scrollArea({ maxHeight: '20rem', label: 'Comments' }, stack({ gap: 3 }, ...comments))
scrollArea({ axis: 'horizontal', label: 'Columns' }, row({ gap: 4 }, ...columns))
scrollArea({ maxHeight: { xs: '14rem', lg: '32rem' }, label: 'Log' }, logLines())
```
