# Visual theme editor (imp site)

The theming engine has landed (`adr/themable-by-default-tokens.md`): a theme is a plain module with
a flat `tokens` map applied via `applyTheme`, and imp ships built-in light / dark themes
(`applyTheme('imp-light' | 'imp-dark')`) to seed from. What remains is the authoring experience.

The public imp site should host a **visual theme editor**: a developer adjusts tokens (color
pickers, spacing/radius scales, typography) against a **live preview** of real stdlib components,
and the editor **exports a ready-to-drop theme file** - the same flat-`tokens` module shape the
engine consumes. The app drops it in, imports it, and applies it.

- Seed the editor from a built-in starter theme (apply `'imp-light'` / `'imp-dark'` and read the
  tokens back off `theme.get()`) so every exported file is complete - copy-and-tweak, no need to
  spell out every token by hand.
- The token surface grows with the stdlib (`todo/stdlib-components.md`); the editor should render
  the tokens that actually have consumers, not a hardcoded list, so new tokens surface automatically
  as components land.
- Export must produce a valid module (`export default { name, colorScheme, tokens }`) that
  round-trips through `applyTheme` unchanged.

This is a **site deliverable** - it depends on the landing site (`todo/landing-site.md`) and the
stdlib components that give the live preview something to skin. Scope it as its own item if it grows
beyond a token form with file export.
