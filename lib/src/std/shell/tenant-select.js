import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { luPlus } from '../../icons/lucide-icons.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { computed, createState } from '../../state.js'
import { oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { itemId, normalizeItems } from '../shared/items.js'
import { avatar } from '../display/avatar.js'
import { tag } from '../display/tag.js'
import { normalizeNavTag } from '../shared/nav-items.js'
import { text } from '../general/text.js'
import { menuButton } from '../general/menu-button.js'
import { VARIANTS } from '../general/button.js'
import { flex } from '../layout/flex.js'
import { stack } from '../layout/stack.js'

const NAME = 'tenantSelect'

const KNOWN_PROPS = [
  'tenants',
  'selected',
  'label',
  'variant',
  'size',
  'compact',
  'onCreateClick',
  'events',
]

const SELECT_EVENT = 'select'

const LABEL_KEY = 'imp.tenant.label'

const CURRENT_KEY = 'imp.tenant.current'

const ACTIONS_KEY = 'imp.tenant.actions'

const CREATE_KEY = 'imp.tenant.create'

const messages = {
  [LABEL_KEY]: 'Workspace',
  [CURRENT_KEY]: 'Workspace: {tenant}',
  [ACTIONS_KEY]: 'Workspace actions',
  [CREATE_KEY]: 'Create workspace',
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

const normalizeTenants = (value) =>
  normalizeItems(NAME, value ?? [], {
    prop: 'tenants',
    shape: '{ id, name, description, picture, tag }',
    key: 'name',
    noun: 'a tenant',
    item: (entry, index) => ({
      id: itemId(entry, index),
      name: entry.name,
      description: entry.description ?? null,
      picture: entry.picture ?? null,
      tag: normalizeNavTag(NAME, entry.tag),
    }),
  })

// The create action: `onCreateClick` when the app passes one, else null.
const createHandler = (props) => {
  const handler = props.onCreateClick
  if (handler === undefined) return null
  if (typeof handler === 'function') return handler
  impLogger.warn(`${NAME}: 'onCreateClick' must be a function - showing no create item`)
  return null
}

const badge = (tenant) =>
  avatar({ name: tenant.name, picture: tenant.picture ?? undefined, size: 'sm', decorative: true })

// The trigger renders inside the shadow root of the button, where the styles of tenantSelect do not
// reach, so its few rules are inline. A long name ends in an ellipsis and the tag stays in view.
const CURRENT_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--imp-space-2, 0.5rem)',
  minInlineSize: '0',
}

const NAME_STYLE = {
  minInlineSize: '0',
  maxInlineSize: 'var(--imp-tenant-select-name-max-inline-size, 12rem)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

// The tag of a tenant, such as the role of the person in it, or nothing.
const tenantTag = (tenant) =>
  tenant.tag === null
    ? null
    : span(
        { class: 'tag', style: { flex: 'none', display: 'inline-flex' } },
        tag({ color: tenant.tag.color, size: 'sm' }, tenant.tag.text),
      )

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the tenants as 'tenants'`)
    }
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'ghost')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const compact = Boolean(props.compact)
    const tenants = isStateShaped(props.tenants)
      ? props.tenants
      : createState('imp.tenantSelect.tenants', props.tenants)
    const given = isStateShaped(props.selected) ? props.selected : null
    const current = given ?? createState('imp.tenantSelect.selected', props.selected ?? null)
    const currentId = computed([current], (value) =>
      value === undefined || value === null ? null : String(value),
    )

    const onCreate = createHandler(props)

    const root = div({ class: 'root', events: props.events })

    const report = (tenant) =>
      root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: tenant.id, tenant },
        }),
      )

    const choose = (tenant) => {
      if (tenant.id === currentId.get()) return
      if (!report(tenant)) return
      if (given === null) current.set(tenant.id)
      else if (typeof given.set === 'function') given.set(tenant.id)
      else {
        impLogger.warn(
          `${NAME}: 'selected' is a read-only state - pass a writable state so ${NAME} can write it back`,
        )
      }
    }

    // The create item opens the menu, above the tenants. It runs only after a held press, so a
    // person who switches tenants never creates one by a slip.
    const createItem = onCreate && {
      id: 'create',
      label: computed([lang], () => t(CREATE_KEY)),
      icon: luPlus,
      hold: true,
      onClick: () => onCreate(),
    }

    // The menus inside fire a select of their own. It stops at their box, under the root, so the
    // `select` handler of the app hears only the choice of a tenant.
    const menus = div({ class: 'menus' })
    menus.addEventListener(SELECT_EVENT, (event) => event.stopPropagation())
    root.append(menus)

    const row = (tenant) =>
      flex(
        { gap: 2, verticalAlign: 'center' },
        badge(tenant),
        stack(
          { gap: 0 },
          flex(
            { gap: 2, verticalAlign: 'center' },
            text({ inline: true, size: 'sm', weight: 'bold' }, tenant.name),
            tenantTag(tenant),
          ),
          tenant.description === null
            ? null
            : text({ inline: true, size: 'sm', tone: 'secondary' }, tenant.description),
        ),
      )

    const picker = (list) => {
      if (list.length === 0) {
        // A person in no tenant still creates the first one.
        impLogger.warn(
          `${NAME}: 'tenants' holds no tenant - ${createItem ? 'showing only the create item' : 'rendering nothing'}`,
        )
        if (!createItem) return null
        return menuButton({
          trigger: 'more',
          variant,
          size,
          label: computed([lang], () => t(ACTIONS_KEY)),
          items: [createItem],
        })
      }
      const currentTenant = computed(
        [currentId],
        (id) => list.find((tenant) => tenant.id === id) ?? list[0],
      )
      const name =
        props.label
        ?? computed([lang, currentTenant], (_language, tenant) =>
          t(CURRENT_KEY, { tenant: tenant.name }),
        )
      const items = list.map((tenant) => ({
        id: tenant.id,
        label: row(tenant),
        checked: computed([currentTenant], (chosen) => chosen.id === tenant.id),
        onClick: () => choose(tenant),
      }))
      if (createItem) items.unshift(createItem)
      return menuButton(
        { trigger: 'arrow', variant, size, label: name, items },
        compact
          ? currentTenant.view((tenant) => badge(tenant))
          : div(
              { class: 'current', style: CURRENT_STYLE },
              currentTenant.view((tenant) => badge(tenant)),
              div(
                { class: 'name', style: NAME_STYLE },
                currentTenant.text((tenant) => tenant.name),
              ),
              currentTenant.view((tenant) => tenantTag(tenant)),
            ),
      )
    }

    menus.append(tenants.view((list) => picker(normalizeTenants(list))))
    return root
  },
}

export const tenantSelect = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
