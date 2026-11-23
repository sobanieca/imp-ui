import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { luPlus } from '../../icons/lucide-icons.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { computed, createState } from '../../state.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { itemId, normalizeItems } from '../shared/items.js'
import { avatar } from '../display/avatar.js'
import { text } from '../general/text.js'
import { menuButton } from '../general/menu-button.js'
import { VARIANTS } from '../general/button.js'
import { flex } from '../layout/flex.js'
import { stack } from '../layout/stack.js'

const NAME = 'orgSelect'

const KNOWN_PROPS = [
  'orgs',
  'selected',
  'label',
  'variant',
  'size',
  'compact',
  'onCreateClick',
  'events',
]

const SELECT_EVENT = 'select'

const LABEL_KEY = 'imp.org.label'

const CURRENT_KEY = 'imp.org.current'

const ACTIONS_KEY = 'imp.org.actions'

const CREATE_KEY = 'imp.org.create'

const messages = {
  [LABEL_KEY]: 'Organization',
  [CURRENT_KEY]: 'Organization: {org}',
  [ACTIONS_KEY]: 'Organization actions',
  [CREATE_KEY]: 'Create organization',
}

const styles = () => `
  .root,
  .menus {
    display: inline-flex;
    min-inline-size: 0;
  }
  .menus {
    align-items: center;
    gap: var(--imp-space-1, 0.25rem);
  }
`

const normalizeOrgs = (value) =>
  normalizeItems(NAME, value ?? [], {
    prop: 'orgs',
    shape: '{ id, name, description, picture }',
    key: 'name',
    noun: 'an organization',
    item: (entry, index) => ({
      id: itemId(entry, index),
      name: entry.name,
      description: entry.description ?? null,
      picture: entry.picture ?? null,
    }),
  })

// The create action: `onCreateClick` when the app passes one, else null.
const createHandler = (props) => {
  const handler = props.onCreateClick
  if (handler === undefined) return null
  if (typeof handler === 'function') return handler
  impLogger.warn(`${NAME}: 'onCreateClick' must be a function - showing no create menu`)
  return null
}

const badge = (org) =>
  avatar({ name: org.name, picture: org.picture ?? undefined, size: 'sm', decorative: true })

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the organizations as 'orgs'`)
    }
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'ghost')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const compact = Boolean(props.compact)
    const orgs = isStateShaped(props.orgs)
      ? props.orgs
      : createState('imp.orgSelect.orgs', props.orgs)
    const given = isStateShaped(props.selected) ? props.selected : null
    const current = given ?? createState('imp.orgSelect.selected', props.selected ?? null)
    const currentId = computed([current], (value) =>
      value === undefined || value === null ? null : String(value),
    )

    const onCreate = createHandler(props)

    const root = div({ class: 'root', events: props.events })

    const report = (org) =>
      root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: org.id, org },
        }),
      )

    const choose = (org) => {
      if (org.id === currentId.get()) return
      if (!report(org)) return
      if (given === null) current.set(org.id)
      else if (typeof given.set === 'function') given.set(org.id)
      else {
        impLogger.warn(
          `${NAME}: 'selected' is a read-only state - pass a writable state so ${NAME} can write it back`,
        )
      }
    }

    // The menus inside fire a select of their own. It stops at their box, under the root, so the
    // `select` handler of the app hears only the choice of an organization.
    const menus = div({ class: 'menus' })
    menus.addEventListener(SELECT_EVENT, (event) => event.stopPropagation())
    root.append(menus)

    const row = (org) =>
      flex(
        { gap: 2, verticalAlign: 'center' },
        badge(org),
        stack(
          { gap: 0 },
          text({ inline: true, size: 'sm', weight: 'bold' }, org.name),
          org.description === null
            ? null
            : text({ inline: true, size: 'sm', tone: 'secondary' }, org.description),
        ),
      )

    const picker = (list) => {
      if (list.length === 0) {
        impLogger.warn(`${NAME}: 'orgs' holds no organization - rendering nothing`)
        return null
      }
      const currentOrg = computed([currentId], (id) => list.find((org) => org.id === id) ?? list[0])
      const name =
        props.label
        ?? computed([lang, currentOrg], (_language, org) => t(CURRENT_KEY, { org: org.name }))
      const items = list.map((org) => ({
        id: org.id,
        label: row(org),
        checked: computed([currentOrg], (chosen) => chosen.id === org.id),
        onClick: () => choose(org),
      }))
      return menuButton(
        { trigger: 'arrow', variant, size, label: name, items },
        compact
          ? currentOrg.view((org) => badge(org))
          : flex(
              { gap: 2, verticalAlign: 'center' },
              currentOrg.view((org) => badge(org)),
              currentOrg.text((org) => org.name),
            ),
      )
    }

    menus.append(orgs.view((list) => picker(normalizeOrgs(list))))
    // The create action sits behind a triple-dot menu of its own, beside the trigger and never in
    // the list of organizations, so a person who switches never creates one by accident.
    if (onCreate) {
      menus.append(
        menuButton({
          trigger: 'more',
          variant,
          size,
          label: computed([lang], () => t(ACTIONS_KEY)),
          items: [
            {
              id: 'create',
              label: computed([lang], () => t(CREATE_KEY)),
              icon: luPlus,
              onClick: () => onCreate(),
            },
          ],
        }),
      )
    }
    return root
  },
}

export const orgSelect = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
