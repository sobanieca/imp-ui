import { MAIN_1, MAIN_2, MAIN_3 } from '../../lib/src/std/preview-look.js'
import {
  luAppWindow,
  luBug,
  luCheck,
  luChevronLeft,
  luChevronRight,
  luCopy,
  luRocket,
  luServer,
  luSplit,
  luWifiOff,
  luZap,
} from '../../lib/src/icons/lucide-icons.js'

const NARROW = '(width < 56.25rem)'
const INK = '#101010'
const STEP_TONES = [MAIN_1, MAIN_2, MAIN_3, INK]
const CARD_TONES = [MAIN_1, MAIN_2, MAIN_3]
const CARD_ICONS = {
  appWindow: luAppWindow,
  bug: luBug,
  rocket: luRocket,
  server: luServer,
  split: luSplit,
  wifiOff: luWifiOff,
  zap: luZap,
}
const EQUATION_OPERATORS = [
  ['+', 'plus'],
  ['=', 'equals'],
]

const escape = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

const IMP_NAME =
  `<span class="imp-name">`
  + `<img class="imp-mark-light" src="/mark-light.svg" alt="">`
  + `<img class="imp-mark-dark" src="/mark-dark.svg" alt="">imp</span>`

const brandName = (html) =>
  html
    .split(/(<code>[^<]*<\/code>)/)
    .map((part) => (part.startsWith('<code>') ? part : part.replace(/\bimp\b/g, IMP_NAME)))
    .join('')

const cardText = (text) => brandName(escape(text).replace(/`([^`]+)`/g, '<code>$1</code>'))

const svgIcon = (className, elements) =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
  + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + elements
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .map(([name, value]) => `${name}="${escape(value)}"`)
          .join(' ')}/>`,
    )
    .join('')
  + `</svg>`

export const renderNotice = () =>
  `<p class="notice" role="note"><strong>Experimental.</strong> imp is in an early phase and has `
  + `no stable release yet. Some things can work in a way that is not intended. Every API, `
  + `config key and command can change. Use it at your own risk.</p>`

export const installCommand = (origin) => `curl -fsSL ${origin}/install.sh | bash`

export const windowsInstallCommand = (origin) => `irm ${origin}/install.ps1 | iex`

const INSTALL_TABS = [
  { id: 'unix', label: 'macOS and Linux', prompt: '$', command: installCommand },
  { id: 'windows', label: 'Windows', prompt: '>', command: windowsInstallCommand },
]

const installTab = ({ id, label }, index) =>
  `<button class="install-tab" type="button" role="tab" id="install-tab-${id}" `
  + `aria-controls="install-panel-${id}" aria-selected="${index === 0}" `
  + `tabindex="${index === 0 ? 0 : -1}">${label}</button>`

const installPanel = ({ id, prompt, command }, origin, index) =>
  `<div class="install-command" role="tabpanel" id="install-panel-${id}" `
  + `aria-labelledby="install-tab-${id}"${index === 0 ? '' : ' hidden'}>`
  + `<code data-prompt="${prompt} ">${escape(command(origin))}</code>`
  + `<button class="copy" type="button" aria-label="Copy the install command">`
  + `${svgIcon('copy-icon', luCopy)}${svgIcon('copied-icon', luCheck)}</button>`
  + `</div>`

export const renderInstall = (origin) =>
  `<div class="install">`
  + `<div class="install-tabs" role="tablist" aria-label="Operating system">`
  + INSTALL_TABS.map(installTab).join('')
  + `</div>`
  + INSTALL_TABS.map((tab, index) => installPanel(tab, origin, index)).join('')
  + `<p class="install-note">x64 and arm64. Then run <code>imp init my-app</code>.</p>`
  + `</div>`

const stateFigure = () =>
  `<div class="state-figure" aria-hidden="true">`
  + `<div class="state-node state-root">`
  + `<span class="state-tag">&lt;app-root&gt;</span>`
  + `<code>initState(self, 'app.user', { name: 'Ada' })</code>`
  + `<span class="state-set"><code>user.set({ name: 'Grace' })</code></span>`
  + `</div>`
  + `<div class="state-wires">`
  + `<span class="state-trunk"></span><span class="state-bar"></span>`
  + `<span class="state-branch state-branch-start"></span>`
  + `<span class="state-branch state-branch-end"></span>`
  + `<span class="state-pulse state-pulse-trunk"></span>`
  + `<span class="state-pulse state-pulse-start"></span>`
  + `<span class="state-pulse state-pulse-end"></span>`
  + `</div>`
  + `<div class="state-leaves">`
  + `<div class="state-node state-leaf">`
  + `<span class="state-tag">&lt;app-profile&gt;</span>`
  + `<code>useState(self, 'app.user')</code>`
  + `<span class="state-value state-name"></span>`
  + `</div>`
  + `<div class="state-node state-leaf">`
  + `<span class="state-tag">&lt;app-greeting&gt;</span>`
  + `<code>useState(self, 'app.user')</code>`
  + `<span class="state-value state-greeting"></span>`
  + `</div>`
  + `</div>`
  + `</div>`

const FIGURES = { state: stateFigure }

const slideMedia = (slide, highlight) => {
  if (slide.figure !== undefined) return FIGURES[slide.figure]()
  const { language, source } = slide.code
  return `<pre class="code"><code>${highlight(source, language)}</code></pre>`
}

const pointPart = (part) =>
  typeof part === 'string'
    ? escape(part)
    : `<a href="${escape(part.href)}">${escape(part.label)}</a>`

const pointHtml = (point) => [point].flat().map(pointPart).join('')

const slideText = (slide) =>
  `<div class="tour-text">`
  + `<p class="tour-eyebrow">${escape(slide.eyebrow)}</p>`
  + `<h3>${escape(slide.title)}</h3>`
  + `<p class="tour-lead">${escape(slide.lead)}</p>`
  + `<ul>${slide.points.map((point) => `<li>${pointHtml(point)}</li>`).join('')}</ul>`
  + `</div>`

export const renderTour = (slides, highlight) =>
  `<section class="section tour" aria-roledescription="carousel" aria-label="How imp works">`
  + `<div class="tour-head"><h2>How imp works</h2>`
  + `<div class="tour-controls">`
  + `<button class="tour-prev" type="button" aria-label="Previous slide">${svgIcon(
    '',
    luChevronLeft,
  )}</button>`
  + `<span class="tour-count"><span class="tour-index">1</span> / ${slides.length}</span>`
  + `<button class="tour-next" type="button" aria-label="Next slide">${svgIcon(
    '',
    luChevronRight,
  )}</button>`
  + `</div></div>`
  + `<div class="tour-track" tabindex="0">`
  + slides
    .map(
      (slide, index) =>
        `<article class="tour-slide" id="tour-${slide.key}" role="group" `
        + `aria-roledescription="slide" aria-label="${index + 1} of ${slides.length}">`
        + `${slideText(slide)}<div class="tour-media">${slideMedia(slide, highlight)}</div>`
        + `</article>`,
    )
    .join('')
  + `</div>`
  + `<ol class="tour-dots">`
  + slides
    .map(
      (slide, index) =>
        `<li><button type="button" data-index="${index}" `
        + `aria-label="Slide ${index + 1}: ${escape(slide.title)}"`
        + `${index === 0 ? ' aria-current="true"' : ''}></button></li>`,
    )
    .join('')
  + `</ol>`
  + `</section>`

export const renderWorkflow = (steps, note) =>
  `<section class="section flow"><h2>The workflow with imp</h2>`
  + `<ol class="steps">`
  + steps
    .map(
      (step, index) =>
        `<li class="step" style="--step-tone: ${STEP_TONES[index % STEP_TONES.length]}">`
        + `<span class="step-mark">${index + 1}</span>`
        + `<div class="step-body"><h3>${escape(step.title)}</h3><p>${escape(step.text)}</p>`
        + `<code class="step-command">${escape(step.command)}</code></div>`
        + `</li>`,
    )
    .join('')
  + `</ol>`
  + `<p class="steps-note">${escape(note)}</p>`
  + `</section>`

const renderEquation = (terms) =>
  `<p class="equation" aria-label="${escape(
    terms
      .map((term, index) =>
        index === 0 ? term.label : `${EQUATION_OPERATORS[index - 1][1]} ${term.label}`,
      )
      .join(' '),
  )}">`
  + terms
    .map(
      (term, index) =>
        `<span class="equation-group">`
        + (index === 0
          ? ''
          : `<span class="equation-operator" aria-hidden="true">${
              EQUATION_OPERATORS[index - 1][0]
            }</span>`)
        + `<span class="equation-term" style="--term-tone: ${CARD_TONES[index % CARD_TONES.length]}">`
        + `${svgIcon('equation-icon', CARD_ICONS[term.icon])}${escape(term.label)}</span>`
        + `</span>`,
    )
    .join('')
  + `</p>`

const renderTags = (tags) =>
  `<ul class="tags">`
  + tags
    .map(
      (tag, index) =>
        `<li class="equation-term" style="--term-tone: ${CARD_TONES[index % CARD_TONES.length]}">`
        + `${svgIcon('equation-icon', CARD_ICONS[tag.icon])}${escape(tag.label)}</li>`,
    )
    .join('')
  + `</ul>`

export const renderPositions = (positions) =>
  `<section class="section positions"><h2>Why imp</h2>`
  + `<ul class="cards">`
  + positions
    .map(
      (position, index) =>
        `<li class="card" style="--card-tone: ${CARD_TONES[index % CARD_TONES.length]}">`
        + `<h3>${cardText(position.title)}</h3>`
        + `<p class="card-lead">${cardText(position.lead)}</p>`
        + `<p>${cardText(position.text)}</p>`
        + (position.points === undefined
          ? ''
          : `<ul>${position.points.map((point) => `<li>${cardText(point)}</li>`).join('')}</ul>`)
        + (position.equation === undefined ? '' : renderEquation(position.equation))
        + (position.tags === undefined ? '' : renderTags(position.tags))
        + (position.link === undefined
          ? ''
          : `<a class="card-link" href="${escape(position.link.href)}">${escape(
              position.link.label,
            )}</a>`)
        + `</li>`,
    )
    .join('')
  + `</ul>`
  + `</section>`

export const overviewStyles = `
.hero::before {
  content: '';
  display: block;
  inline-size: 72px;
  block-size: 6px;
  margin-block-end: var(--imp-space-5);
  background: linear-gradient(90deg, ${MAIN_1} 0 40%, ${MAIN_2} 40% 70%, ${MAIN_3} 70%);
}

.hero .notice {
  display: flex;
  gap: var(--imp-space-3);
  align-items: baseline;
  box-sizing: border-box;
  max-inline-size: 100%;
  margin: 0 0 var(--imp-space-5);
  padding-block: var(--imp-space-3);
  padding-inline: var(--imp-space-4);
  border: var(--imp-border-width) solid ${MAIN_2};
  border-inline-start-width: 4px;
  border-radius: var(--imp-radius-container);
  background: rgb(from ${MAIN_2} r g b / 8%);
  font-size: var(--imp-font-size-md);
}

.hero .notice strong {
  flex: none;
  color: ${MAIN_2};
  font-family: var(--imp-font-family-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.install {
  margin-block: var(--imp-space-5);
}

.install-command {
  display: flex;
  align-items: center;
  gap: var(--imp-space-3);
  box-sizing: border-box;
  max-inline-size: 100%;
  padding-block: var(--imp-space-3);
  padding-inline: var(--imp-space-4) var(--imp-space-2);
  border-radius: var(--imp-radius-container);
  background: ${INK};
  color: #ffffff;
}

.install-command[hidden] { display: none }

:root[data-scheme='dark'] .install-command {
  border: var(--imp-border-width) solid var(--imp-color-border);
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
}

.install-command code {
  flex: 1 1 auto;
  min-inline-size: 0;
  padding: 0;
  background: none;
  color: inherit;
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-md);
  overflow-x: auto;
  white-space: nowrap;
}

.install-command code::before {
  content: attr(data-prompt);
  color: ${MAIN_1};
}

.install-tabs {
  display: flex;
  gap: var(--imp-space-1);
  margin-block-end: var(--imp-space-2);
}

.install-tab {
  padding-block: var(--imp-space-1);
  padding-inline: var(--imp-space-3);
  border: var(--imp-border-width) solid transparent;
  border-radius: var(--imp-radius-item);
  background: transparent;
  color: var(--imp-color-secondary);
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-sm);
  cursor: pointer;
}

.install-tab:hover { background: var(--imp-color-surface-hover) }

.install-tab[aria-selected='true'] {
  border-color: var(--imp-color-border);
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
}

.copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--imp-radius-item);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.copy:hover { background: rgb(from currentColor r g b / 12%) }

.copy svg {
  inline-size: 1.1rem;
  block-size: 1.1rem;
}

.copy .copied-icon,
.copy.is-copied .copy-icon { display: none }

.copy.is-copied .copied-icon {
  display: block;
  color: ${MAIN_1};
}

.install-note {
  margin: var(--imp-space-3) 0 0;
  color: var(--imp-color-secondary);
  font-size: var(--imp-font-size-md);
}

.tour { padding-block-end: var(--imp-space-4) }

.tour-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--imp-space-4);
  margin-block-end: var(--imp-space-4);
}

.tour-head h2 { margin: 0 }

.tour-controls {
  display: flex;
  align-items: center;
  gap: var(--imp-space-2);
}

.tour-count {
  min-inline-size: 4ch;
  white-space: nowrap;
  color: var(--imp-color-secondary);
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-sm);
  text-align: center;
}

.tour-prev,
.tour-next {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: 50%;
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  cursor: pointer;
}

.tour-prev:hover,
.tour-next:hover { background: var(--imp-color-surface-hover) }

.tour-prev svg,
.tour-next svg {
  inline-size: 1rem;
  block-size: 1rem;
}

.tour-track {
  display: flex;
  gap: var(--imp-space-6);
  margin-inline: calc(-1 * var(--imp-space-6));
  padding-inline: var(--imp-space-6);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: inline mandatory;
  scroll-padding-inline: var(--imp-space-6);
  scrollbar-width: none;
}

.tour-track::-webkit-scrollbar { display: none }

.tour-track:focus-visible {
  outline: var(--imp-focus-ring-width) solid ${MAIN_1};
  outline-offset: 2px;
}

.tour-slide {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: var(--imp-space-6);
  flex: 0 0 100%;
  align-content: start;
  box-sizing: border-box;
  min-inline-size: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.tour-text {
  display: flex;
  flex-direction: column;
  gap: var(--imp-space-3);
}

.tour-eyebrow {
  margin: 0;
  color: ${MAIN_1};
  font-family: var(--imp-font-family-mono);
  font-size: var(--imp-font-size-sm);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tour-text h3 {
  margin: 0;
  font-family: var(--imp-font-family-heading);
  font-size: var(--imp-font-size-xl);
  line-height: var(--imp-line-height-tight);
}

.tour-lead {
  margin: 0;
  font-size: var(--imp-font-size-lg);
}

.tour-text ul {
  margin: 0;
  padding-inline-start: 1.2em;
  color: var(--imp-color-secondary);
}

.tour-text li::marker { color: ${MAIN_2} }

.tour-text a { color: var(--imp-color-primary) }

.tour-media {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-inline-size: 0;
}

.tour-media pre.code {
  margin: 0;
  background: var(--imp-color-surface-sunken);
}

.tour-dots {
  display: flex;
  justify-content: center;
  gap: var(--imp-space-2);
  margin: var(--imp-space-4) 0 0;
  padding: 0;
  list-style: none;
}

.tour-dots button {
  display: block;
  inline-size: 10px;
  block-size: 10px;
  padding: 0;
  border: 0;
  background: var(--imp-color-border);
  cursor: pointer;
  transition: inline-size var(--imp-duration-fast), background var(--imp-duration-fast);
}

.tour-dots button:hover { background: var(--imp-color-secondary) }

.tour-dots button[aria-current='true'] {
  inline-size: 24px;
  background: ${MAIN_1};
}

.tour-dots button:focus-visible,
.tour-prev:focus-visible,
.tour-next:focus-visible,
.install-tab:focus-visible,
.copy:focus-visible {
  outline: var(--imp-focus-ring-width) solid ${MAIN_1};
  outline-offset: 2px;
}

.state-figure {
  --state-wire: var(--imp-color-secondary);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  min-inline-size: 0;
  font-size: var(--imp-font-size-sm);
}

.state-node {
  display: flex;
  flex-direction: column;
  gap: var(--imp-space-1);
  box-sizing: border-box;
  min-inline-size: 0;
  padding: var(--imp-space-3);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-container);
  background: var(--imp-color-surface-sunken);
}

.state-node code {
  padding: 0;
  background: none;
  font-size: var(--imp-font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.state-tag {
  color: ${MAIN_3};
  font-family: var(--imp-font-family-mono);
}

.state-root {
  position: relative;
  border-color: ${INK};
}

:root[data-scheme='dark'] .state-root { border-color: var(--imp-color-text) }

.state-set {
  box-sizing: border-box;
  position: absolute;
  inset-block-start: calc(-1 * var(--imp-space-3));
  inset-inline-end: var(--imp-space-3);
  padding-block: 2px;
  padding-inline: var(--imp-space-2);
  border: var(--imp-border-width) solid ${MAIN_1};
  border-radius: var(--imp-radius-item);
  background: var(--imp-color-surface);
  color: ${MAIN_1};
  opacity: 0;
  animation: state-set 6s infinite;
}

.state-set code {
  overflow: visible;
  color: inherit;
  font-size: var(--imp-font-size-sm);
}

.state-wires {
  position: relative;
  block-size: 56px;
}

.state-trunk,
.state-bar,
.state-branch {
  position: absolute;
  background: var(--state-wire);
}

.state-trunk {
  inset-inline-start: calc(50% - 1px);
  inset-block-start: 0;
  inline-size: 2px;
  block-size: 28px;
}

.state-bar {
  inset-inline: 25% 25%;
  inset-block-start: 27px;
  block-size: 2px;
}

.state-branch {
  inset-block-start: 28px;
  inline-size: 2px;
  block-size: 28px;
}

.state-branch-start { inset-inline-start: calc(25% - 1px) }
.state-branch-end { inset-inline-end: calc(25% - 1px) }

.state-pulse {
  position: absolute;
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: ${MAIN_1};
  box-shadow: 0 0 0 4px rgb(from ${MAIN_1} r g b / 25%);
  opacity: 0;
}

.state-pulse-trunk {
  inset-inline-start: calc(50% - 5px);
  inset-block-start: -5px;
  animation: state-trunk 6s infinite;
}

.state-pulse-start,
.state-pulse-end {
  inset-block-start: 23px;
  animation: state-branch 6s infinite;
}

.state-pulse-start { inset-inline-start: calc(25% - 5px) }
.state-pulse-end { inset-inline-end: calc(25% - 5px) }

.state-leaves {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--imp-space-4);
}

.state-leaf { animation: state-leaf 6s infinite }

.state-value {
  align-self: start;
  margin-block-start: var(--imp-space-1);
  padding-block: 2px;
  padding-inline: var(--imp-space-2);
  border-radius: var(--imp-radius-item);
  background: var(--imp-color-surface);
  border: var(--imp-border-width) solid var(--imp-color-border);
  font-family: var(--imp-font-family-mono);
}

.state-name::after {
  content: 'Ada';
  animation: state-name 6s infinite;
}

.state-greeting::after {
  content: 'Hi, Ada';
  animation: state-greeting 6s infinite;
}

@keyframes state-set {
  0%, 4% { opacity: 0; translate: 0 4px }
  10%, 70% { opacity: 1; translate: 0 0 }
  80%, 100% { opacity: 0 }
}

@keyframes state-trunk {
  0%, 12% { opacity: 0; translate: 0 0 }
  14% { opacity: 1 }
  28% { opacity: 1; translate: 0 28px }
  30%, 100% { opacity: 0; translate: 0 28px }
}

@keyframes state-branch {
  0%, 28% { opacity: 0; translate: 0 0 }
  30% { opacity: 1 }
  44% { opacity: 1; translate: 0 28px }
  46%, 100% { opacity: 0; translate: 0 28px }
}

@keyframes state-leaf {
  0%, 44% { border-color: var(--imp-color-border) }
  47%, 60% { border-color: ${MAIN_1} }
  75%, 100% { border-color: var(--imp-color-border) }
}

@keyframes state-name {
  0%, 46% { content: 'Ada' }
  47%, 100% { content: 'Grace' }
}

@keyframes state-greeting {
  0%, 46% { content: 'Hi, Ada' }
  47%, 100% { content: 'Hi, Grace' }
}

@media (prefers-reduced-motion: reduce) {
  .state-set,
  .state-pulse,
  .state-leaf,
  .state-name::after,
  .state-greeting::after { animation: none }

  .state-set { opacity: 1 }
  .state-name::after { content: 'Grace' }
  .state-greeting::after { content: 'Hi, Grace' }
  .tour-dots button { transition: none }
}

.steps {
  display: grid;
  gap: var(--imp-space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: var(--imp-space-4);
  max-inline-size: none;
}

.step:not(:last-child)::before {
  content: '';
  position: absolute;
  inset-inline-start: 19px;
  inset-block-start: 40px;
  inline-size: 2px;
  block-size: calc(100% + var(--imp-space-5) - 40px);
  background: var(--imp-color-border);
}

.step-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  background: var(--step-tone);
  color: #ffffff;
  font-family: var(--imp-font-family-heading);
  font-weight: var(--imp-font-weight-bold);
}

:root[data-scheme='dark'] .step:last-child .step-mark {
  background: var(--imp-color-text);
  color: ${INK};
}

.step-body {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: var(--imp-space-2);
  padding-block-start: var(--imp-space-2);
}

.step-body h3 {
  margin: 0;
  font-family: var(--imp-font-family-heading);
  font-size: var(--imp-font-size-lg);
}

.step-body p {
  margin: 0;
  max-inline-size: 60ch;
  color: var(--imp-color-secondary);
}

.step-command {
  padding-block: 2px;
  padding-inline: var(--imp-space-2);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-radius: var(--imp-radius-item);
  background: var(--imp-color-surface-sunken);
  font-size: var(--imp-font-size-sm);
}

.steps-note {
  margin: var(--imp-space-5) 0 0;
  padding-inline-start: var(--imp-space-4);
  border-inline-start: 3px solid ${MAIN_2};
  color: var(--imp-color-secondary);
}

.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--imp-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: var(--imp-space-3);
  box-sizing: border-box;
  max-inline-size: none;
  padding: var(--imp-space-5);
  border: var(--imp-border-width) solid var(--imp-color-border);
  border-block-start: 3px solid var(--card-tone);
  border-radius: var(--imp-radius-item);
  background: var(--imp-color-surface-sunken);
}

.card h3 {
  margin: 0;
  font-family: var(--imp-font-family-heading);
  font-size: var(--imp-font-size-lg);
  text-wrap: balance;
}

.card p {
  margin: 0;
  max-inline-size: none;
}

.card-lead { font-weight: var(--imp-font-weight-bold) }

.card p:not(.card-lead),
.card ul { color: var(--imp-color-secondary) }

.card ul {
  margin: 0;
  padding-inline-start: var(--imp-space-4);
}

.card li { max-inline-size: none }

.card-link { margin-block-start: auto }

.equation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--imp-space-2);
  margin-block-start: auto;
  padding-block-start: var(--imp-space-2);
  font-family: var(--imp-font-family-heading);
  font-size: var(--imp-font-size-md);
  font-weight: var(--imp-font-weight-bold);
}

.card .tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--imp-space-2);
  margin: auto 0 0;
  padding: var(--imp-space-2) 0 0;
  list-style: none;
  font-family: var(--imp-font-family-heading);
  font-size: var(--imp-font-size-sm);
  font-weight: var(--imp-font-weight-bold);
}

.card .tags li { color: var(--term-tone) }

.equation-group {
  display: inline-flex;
  align-items: center;
  gap: var(--imp-space-2);
}

.equation-term {
  display: inline-flex;
  align-items: center;
  gap: var(--imp-space-2);
  padding-block: var(--imp-space-1);
  padding-inline: var(--imp-space-2);
  border-radius: 999px;
  background: color-mix(in oklab, var(--term-tone) 12%, transparent);
  color: var(--term-tone);
}

.equation-icon {
  inline-size: 1.25em;
  block-size: 1.25em;
}

.equation-operator {
  font-family: var(--imp-font-family-mono);
  color: var(--imp-color-secondary);
}

@media ${NARROW} {
  .cards { grid-template-columns: minmax(0, 1fr) }

  .tour-slide {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--imp-space-4);
  }

  .tour-media { justify-content: start }

  .tour-track {
    margin-inline: calc(-1 * var(--imp-space-4));
    padding-inline: var(--imp-space-4);
    scroll-padding-inline: var(--imp-space-4);
  }

  .state-set {
    position: static;
    align-self: start;
    max-inline-size: 100%;
    margin-block-start: var(--imp-space-1);
  }

  .state-set code {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
`

export const overviewScript = () =>
  `const tour = document.querySelector('.tour')
const track = tour.querySelector('.tour-track')
const slides = [...track.querySelectorAll('.tour-slide')]
const dots = [...tour.querySelectorAll('.tour-dots button')]
const index = tour.querySelector('.tour-index')
let current = 0
let scrolling = false

const mark = (next) => {
  if (next === current) return
  dots[current].removeAttribute('aria-current')
  current = next
  dots[current].setAttribute('aria-current', 'true')
  index.textContent = String(current + 1)
}

const show = (next) => {
  const target = (next + slides.length) % slides.length
  mark(target)
  scrolling = true
  slides[target].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
}

const nearest = () => {
  const start = track.getBoundingClientRect().left
  let best = 0
  let distance = Infinity
  slides.forEach((slide, position) => {
    const gap = Math.abs(slide.getBoundingClientRect().left - start)
    if (gap < distance) {
      distance = gap
      best = position
    }
  })
  return best
}

const observer = new IntersectionObserver((entries) => {
  if (scrolling) return
  for (const entry of entries) {
    if (entry.isIntersecting) mark(slides.indexOf(entry.target))
  }
}, { root: track, threshold: 0.6 })
for (const slide of slides) observer.observe(slide)
track.addEventListener('scrollend', () => {
  scrolling = false
  mark(nearest())
})

tour.querySelector('.tour-prev').addEventListener('click', () => show(current - 1))
tour.querySelector('.tour-next').addEventListener('click', () => show(current + 1))
for (const dot of dots) {
  dot.addEventListener('click', () => show(Number(dot.dataset.index)))
}
track.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    show(current + 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    show(current - 1)
  }
})

const tabs = [...document.querySelectorAll('.install-tab')]
const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')))

const select = (index, focus) => {
  tabs.forEach((tab, position) => {
    const selected = position === index
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    panels[position].hidden = !selected
  })
  if (focus) tabs[index].focus()
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => select(index, false))
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index }[
      event.key
    ]
    if (step === undefined) return
    event.preventDefault()
    select((index + step + tabs.length) % tabs.length, true)
  })
})

if (navigator.platform.startsWith('Win')) {
  select(tabs.findIndex((tab) => tab.id === 'install-tab-windows'), false)
}

for (const copy of document.querySelectorAll('.copy')) {
  copy.addEventListener('click', async () => {
    const command = copy.previousElementSibling.textContent
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      return
    }
    copy.classList.add('is-copied')
    copy.setAttribute('aria-label', 'Copied')
    setTimeout(() => {
      copy.classList.remove('is-copied')
      copy.setAttribute('aria-label', 'Copy the install command')
    }, 1600)
  })
}
`
