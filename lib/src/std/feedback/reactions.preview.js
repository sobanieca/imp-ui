import { component } from 'imp'
import { text } from 'imp/std'
import { card } from 'imp/std/display'
import { reactions } from 'imp/std/feedback'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Reactions'
export const group = groups.feedback

const post = (body) => card(text(body))

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const onCard = {
  scenario: 'Around a card',
  component: reactions(
    {
      items: [
        { emoji: '\u{1F44D}', count: 12, reacted: true },
        { emoji: '\u{1F389}', count: 4 },
        { emoji: '\u{2764}\u{FE0F}', count: 3 },
      ],
      onReact: (emoji, reacted) => console.log(reacted ? 'add' : 'remove', emoji),
    },
    post('We shipped the new billing page. Thanks to everyone who tested it!'),
  ),
}

export const server = {
  scenario: 'Sent to a server, with the state in the app',
  component: component('reactions-server-demo', {
    setup: (self) => {
      const items = initState(self, 'demo.reactions.items', [
        { emoji: '\u{1F440}', count: 2 },
        { emoji: '\u{1F680}', count: 5, reacted: true },
      ])
      const sent = initState(self, 'demo.reactions.sent', 'Nothing sent yet')
      return stack(
        { gap: 2 },
        reactions(
          {
            items,
            onReact: async (emoji, reacted) => {
              sent.set(`Sending: ${reacted ? 'add' : 'remove'} ${emoji}`)
              await wait(600)
              sent.set(`Saved: ${reacted ? 'add' : 'remove'} ${emoji}`)
            },
          },
          post('Release 2.4 is in staging. Please have a look before Friday.'),
        ),
        text({ tone: 'secondary', size: 'sm' }, sent.text((line) => line)),
        text(
          { tone: 'secondary', size: 'sm' },
          items.text((list) =>
            `State: ${list.map(({ emoji, count }) => `${emoji} ${count}`).join(', ')}`
          ),
        ),
      )
    },
  })(),
}

export const failing = {
  scenario: 'The server refuses, so the reaction goes back',
  component: reactions(
    {
      items: [{ emoji: '\u{1F44F}', count: 7 }],
      onReact: async () => {
        await wait(800)
        throw new Error('Offline')
      },
    },
    post('Click a reaction. It shows at once, then goes back when the request fails.'),
  ),
}

export const ownSet = {
  scenario: 'An allowed set of reactions',
  component: reactions(
    {
      items: [{ emoji: '\u{2705}', count: 2 }, { emoji: '\u{1F525}', count: 3 }],
      emojis: [
        '\u{1F44D}',
        '\u{1F44E}',
        '\u{1F604}',
        '\u{1F389}',
        '\u{1F615}',
        '\u{2764}\u{FE0F}',
        '\u{1F680}',
        '\u{1F440}',
        '\u{2705}',
      ],
    },
    post(
      'Only nine reactions are allowed here, so the panel has no search field. The fire is outside the set, so its count shows and nobody can add one.',
    ),
  ),
}

export const barOnly = {
  scenario: 'The bar alone, with no content',
  component: reactions({ items: [{ emoji: '\u{1F525}', count: 1284 }] }),
}

export const disabled = {
  scenario: 'Disabled, counts only',
  component: reactions(
    {
      disabled: true,
      items: [
        { emoji: '\u{1F44D}', count: 8, reacted: true },
        { emoji: '\u{1F602}', count: 2 },
      ],
    },
    post('This thread is archived. The counts show, and nobody can react.'),
  ),
}
