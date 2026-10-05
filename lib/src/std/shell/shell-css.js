import {
  focusRing,
  fontFamily,
  forcedColors,
  quietScrollbar,
  token,
  visuallyHidden,
} from '../shared/css.js'
import { overlayMotion, overlayScrim } from '../shared/overlay.js'
import { tooltipStyles } from '../display/tooltip.js'
import { backdropStyles } from '../shared/backdrop.js'
import { navLinkStyles } from '../shared/nav-items.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'

const SHEET_ANCHOR = '--imp-shell-sheet'

const BARE_INLINE_SIZE = '--imp-shell-bare-inline-size'

const HEAD_BLOCK_SIZE = '3.5rem'

export const shellStyles = () => `
  :host {
    display: block;
    block-size: 100dvb;
  }

  .shell {
    --sidebar-track: 0px;
    --frame-gap: 0px;
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: var(--frame-gap) var(--sidebar-track) minmax(0, 1fr) var(--frame-gap);
    grid-template-rows: auto minmax(0, 1fr) auto;
    box-sizing: border-box;
    block-size: 100%;
    padding-block: var(--frame-gap);
    ${fontFamily()}
    background: ${token('background-app')};
    color: ${token('color-text')};
  }

  .shell.limited {
    grid-template-columns:
      minmax(var(--frame-gap), 1fr)
      var(--sidebar-track)
      minmax(0, calc(var(--page-max) - var(--sidebar-track)))
      minmax(var(--frame-gap), 1fr);
  }

  ${backdropStyles()}

  .region {
    min-inline-size: 0;
    min-block-size: 0;
    box-sizing: border-box;
  }

  ${navLinkStyles()}

  .link {
    border-inline-start: calc(${token('border-width')} * 2) solid transparent;
    border-radius: 0;
  }

  .sidebar-body .link[aria-current],
  .drawer-nav .link[aria-current] {
    border-inline-start-color: ${token('color-primary')};
  }

  .topbar {
    grid-row: 1;
    grid-column: 1 / -1;
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: subgrid;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface-sunken')};
  }

  .bar {
    grid-column: 2 / 4;
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    min-inline-size: 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
  }

  .shell.gapped .topbar { grid-column: 2 / 4 }

  .shell.gapped .bar { grid-column: 1 / -1 }

  .shell:not(.has-sidebar) .sidebar { display: none }

  .bar-logo:empty,
  .sidebar-logo:empty,
  .bar-body:empty,
  .bar-tools:empty,
  .bar-title:empty,
  .drawer-nav:empty,
  .drawer-tools:empty,
  .drawer-foot:empty,
  .sidebar-extras:empty,
  .sidebar-foot:empty {
    display: none;
  }

  .bar-logo { flex: none }

  .bar-body {
    flex: 1;
    min-inline-size: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bar-body::-webkit-scrollbar { display: none }

  .bar-tools {
    flex: none;
    margin-inline-start: auto;
  }

  .bar-title {
    display: none;
    flex-direction: column;
    min-inline-size: 0;
    line-height: ${token('line-height-tight')};
  }

  .bar-title .over {
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-secondary')};
  }

  .bar-title .now {
    font-weight: ${token('font-weight-bold')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .main {
    grid-row: 2;
    grid-column: 2 / 4;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: ${token('space-4')};
  }

  .trail {
    display: flex;
    align-items: center;
    flex: none;
    box-sizing: border-box;
    min-block-size: calc(${HEAD_BLOCK_SIZE} - ${token('space-4')} - ${token('space-3')});
    margin-block-end: ${token('space-3')};
  }

  .shell.gapped .trail {
    min-block-size: calc(
      ${HEAD_BLOCK_SIZE} + ${token('border-width')} - ${token('space-4')} - ${token('space-3')}
    );
  }

  .trail:empty,
  .trail[hidden] { display: none }

  .sidebar,
  .bottombar {
    display: none;
    background-color: ${token('color-surface-sunken')};
  }

  .sidebar {
    position: relative;
    isolation: isolate;
    flex-direction: column;
    overflow: hidden;
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    box-sizing: border-box;
    min-block-size: ${HEAD_BLOCK_SIZE};
    padding: ${token('space-2')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-logo { flex: none }

  .sidebar-head .here {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-primary')};
    white-space: nowrap;
  }

  .sidebar-extras,
  .sidebar-foot {
    flex: none;
    padding: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-extras .extras,
  .drawer-tools .extras {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .sidebar-body,
  .drawer-nav,
  .sheet {
    ${quietScrollbar()}
  }

  .sidebar-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-block: ${token('space-2')};
  }

  .sidebar-body ul,
  .bar-body ul,
  .drawer-nav ul,
  .drawer-foot ul,
  .sheet ul {
    display: flex;
    flex-direction: column;
  }

  .bar-body ul {
    flex-direction: row;
    align-items: stretch;
    gap: ${token('space-1')};
  }

  .bar-body .link {
    border-inline-start: none;
    border-block-end: calc(${token('border-width')} * 2) solid transparent;
  }

  .bar-body .link[aria-current] {
    border-block-end-color: ${token('color-primary')};
    background-color: transparent;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .group-title .tag { margin-inline-start: 0 }

  .child .link { padding-inline-start: ${token('space-6')} }

  .caret {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    margin-inline-start: auto;
    transition: rotate ${token('duration-fast')} ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .caret { transition: none }
  }

  .link[aria-expanded='true'] .caret { rotate: 90deg }

  .link:dir(rtl) .caret { rotate: 180deg }

  .link[aria-expanded='true']:dir(rtl) .caret { rotate: 90deg }

  .tag ~ .caret { margin-inline-start: 0 }

  .shell.rail .sidebar-body .label,
  .shell.rail .sidebar-foot .label {${visuallyHidden}}

  .shell.rail .sidebar-body .tag,
  .shell.rail .sidebar-body .caret,
  .shell.rail .sidebar-body .group-title,
  .shell.rail .sidebar-body .child,
  .shell.rail .sidebar-head .here,
  .shell.rail .sidebar-logo,
  .shell.rail .sidebar-extras,
  .shell.rail .sidebar-foot .tools {
    display: none;
  }

  ${tooltipStyles()}

  .shell.rail .sidebar-foot:not(:has(.footer)) { display: none }

  .shell.rail .sidebar-head .rail-toggle { margin-inline: auto }

  .shell.rail .sidebar-body .link,
  .shell.rail .sidebar-foot .link {
    justify-content: center;
    padding-inline: 0;
  }

  .bottombar {
    grid-row: 3;
    grid-column: 2 / 4;
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .bottombar ul {
    display: flex;
    align-items: stretch;
  }

  .bottombar li {
    flex: 1;
    min-inline-size: 0;
  }

  .bottombar .link {
    box-sizing: border-box;
    position: relative;
    flex-direction: column;
    justify-content: center;
    gap: ${token('space-1')};
    inline-size: 100%;
    min-block-size: 3.5rem;
    padding-inline: ${token('space-1')};
    border-inline-start: none;
    border-block-start: calc(${token('border-width')} * 2) solid transparent;
    font-size: ${token('font-size-sm')};
  }

  .bottombar .link[aria-current] {
    border-block-start-color: ${token('color-primary')};
  }

  .bottombar .caret,
  .sheet .caret,
  .bar-body .caret {
    display: none;
  }

  .bottombar .label {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bottombar .tag {
    position: absolute;
    margin: 0;
    inset-block-start: ${token('space-1')};
    inset-inline-start: calc(50% + ${token('space-2')});
  }

  .tools {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .sidebar-foot .tools,
  .drawer-tools .tools {
    flex-direction: column;
    align-items: stretch;
  }

  .hamburger,
  .rail-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    margin: 0;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .hamburger {
    inline-size: 2.75rem;
    block-size: 2.75rem;
  }

  .rail-toggle {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    margin-inline-start: auto;
  }

  .rail-toggle[hidden] { display: none }

  .hamburger:hover,
  .rail-toggle:hover {
    background-color: ${token('color-surface-hover')};
  }

  .hamburger:focus-visible,
  .rail-toggle:focus-visible {${focusRing()}}

  .hamburger { display: none }

  .skip {
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-start: ${token('space-2')};
    z-index: 3;
    padding: ${token('space-2')} ${token('space-3')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
    font-weight: ${token('font-weight-bold')};
    text-decoration: none;
    ${visuallyHidden}
  }

  .skip:focus-visible {
    ${focusRing()}
    position: absolute;
    inline-size: auto;
    block-size: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }

  .main:focus,
  .gate:focus { outline: none }

  .gate {
    grid-row: 1 / -1;
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${token('space-6')};
    box-sizing: border-box;
    min-block-size: 0;
    overflow: auto;
    padding: ${token('space-page')};
  }

  .gate-logo:empty { display: none }

  .gate-body {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: var(${BARE_INLINE_SIZE}, 28rem);
  }

  .icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }

  .sheet-anchor { anchor-name: ${SHEET_ANCHOR} }

  .sheet {
    position: fixed;
    position-anchor: ${SHEET_ANCHOR};
    position-area: block-start;
    position-try-fallbacks: block-start span-inline-end, block-start span-inline-start;
    position-visibility: anchors-visible;
    inset: auto;
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: 12rem;
    max-inline-size: calc(100dvi - ${token('space-4')} * 2);
    max-block-size: 60dvb;
    margin: ${token('space-2')};
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    box-shadow: ${token('shadow-md')};
    overflow: auto;
    overscroll-behavior: contain;
  }

  .sheet::backdrop { background-color: transparent }

  .sheet:not(:popover-open) { display: none }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-inline-start: ${token('space-2')};
    margin-block-end: ${token('space-1')};
  }

  .sheet-head .title {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-primary')};
  }

  .sheet-head .title-link {
    padding-block: ${token('space-1')};
    padding-inline: 0 ${token('space-2')};
    font-size: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
  }

  .sheet-head .title-link .caret { margin-inline-start: ${token('space-1')} }

  .sheet-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: 2rem;
    block-size: 2rem;
    margin: 0;
    margin-inline-start: auto;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-secondary')};
    cursor: pointer;
  }

  .sheet-close:hover {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .sheet-close:focus-visible {${focusRing()}}

  .sheet ul {
    display: grid;
    grid-template-columns: 1fr;
    gap: ${token('space-1')};
  }

  .sheet .link {
    min-block-size: 2rem;
    padding-block: ${token('space-2')};
    border: none;
    border-radius: ${token('radius-item')};
  }

  .sheet .link[aria-current] {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-primary')};
  }

  .sheet .child .link { padding-inline-start: ${token('space-3')} }

  .drawer {
    --overlay-offset: -100% 0;
    isolation: isolate;
    margin: 0;
    padding: 0;
    border: none;
    --drawer-max-block-size: 100dvb;
    inline-size: min(var(--imp-shell-sidebar-inline-size, 16rem), 85dvi);
    block-size: fit-content;
    max-block-size: var(--drawer-max-block-size);
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
  }

  .drawer:dir(rtl) { --overlay-offset: 100% 0 }

  ${overlayMotion('.drawer')}

  ${overlayScrim('.drawer')}

  .drawer-body {
    display: flex;
    flex-direction: column;
    max-block-size: var(--drawer-max-block-size);
    box-sizing: border-box;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    padding: ${token('space-2')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .drawer-head .bar-logo { flex: 1 }

  .drawer-nav {
    flex: 0 1 auto;
    min-block-size: 0;
    overflow: auto;
    padding-block: ${token('space-2')};
  }

  .drawer-foot,
  .drawer-tools {
    flex: none;
    padding: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .drawer-tools {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
  }

  .shell.gapped:not(.has-trail) .main { padding-block-start: 0 }

  .shell.gapped .topbar { margin-block-end: var(--frame-gap) }
  .shell.gapped .sidebar { margin-inline-end: var(--frame-gap) }

  .shell.gapped .bottombar {
    margin-block-start: var(--frame-gap);
    overflow: hidden;
  }

  .shell.gapped .drawer {
    margin: var(--frame-gap);
    --drawer-max-block-size: calc(100dvb - var(--frame-gap) * 2);
    inline-size: min(var(--imp-shell-sidebar-inline-size, 16rem), calc(85dvi - var(--frame-gap)));
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
  }

  .shell.gapped .topbar,
  .shell.gapped .sidebar,
  .shell.gapped .bottombar {
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
  }

  @media (width < ${DESKTOP_MIN_WIDTH}) {
    .shell.has-bottom-bar .bottombar { display: block }
    .shell.foldable .hamburger { display: inline-flex }
    .bar-title { display: flex }
    .topbar .bar-logo { display: none }
    .trail { display: none }
    .shell.gapped .main { padding-block-start: 0 }
  }

  @media (min-width: ${DESKTOP_MIN_WIDTH}) {
    .shell.has-sidebar {
      --sidebar-track: calc(var(--imp-shell-sidebar-inline-size, 16rem) + var(--frame-gap));
    }

    .shell.has-sidebar.rail { --sidebar-track: calc(3.75rem + var(--frame-gap)) }

    .bar { padding-inline: ${token('space-4')} }

    .shell.bar-away .topbar { display: none }
    .shell.has-sidebar .sidebar { display: flex; grid-row: 2; grid-column: 2 }
    .main { grid-column: 3 }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .bar-body .link[aria-current] { border-block-end-color: Highlight }
    .sidebar-body .link[aria-current] { border-inline-start-color: Highlight }
    .bottombar .link[aria-current] { border-block-start-color: Highlight }
  }

  .sr-only {${visuallyHidden}}
`
