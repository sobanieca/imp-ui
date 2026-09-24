import {
  luCompass,
  luEye,
  luLayoutDashboard,
  luLayoutTemplate,
  luMessageSquareWarning,
  luShapes,
  luTable,
  luTextCursorInput,
} from 'imp/icons'

export const groups = {
  general: {
    name: 'General',
    icon: luShapes,
    description:
      'The controls that every page starts with: button, link, icon, heading, text and the menu ' +
      'button. Each one renders its native element, so the browser gives it the role and the keys.',
  },
  layout: {
    name: 'Layout',
    icon: luLayoutTemplate,
    description:
      'The boxes that place other components: stack, flex, card, dialog, drawer and the app shell. ' +
      'They own the spacing between their children, so a child carries no outer margin.',
  },
  inputs: {
    name: 'Inputs',
    icon: luTextCursorInput,
    description:
      'The form controls, from a text field to a date picker and a rich text editor, and the form ' +
      'that validates them. Each control renders its own label and error message.',
  },
  display: {
    name: 'Display',
    icon: luEye,
    description:
      'The read-only surfaces that show content: card, tag, avatar, tooltip, accordion, code block, ' +
      'markdown, description list and empty state. Nothing here takes input.',
  },
  navigation: {
    name: 'Navigation',
    icon: luCompass,
    description: 'The composite widgets that move a reader through a flow: tabs and steps. ' +
      'Both take their items as data, and arrow keys move between them.',
  },
  shell: {
    name: 'Shell',
    icon: luLayoutDashboard,
    priority: 1,
    description:
      'The parts of the app frame: the logo, the breadcrumbs, the user card, the notifications, and ' +
      'the language and theme selectors. Each one is made for a slot of the shell.',
  },
  feedback: {
    name: 'Feedback',
    icon: luMessageSquareWarning,
    description:
      'The components that tell the reader what happened: notice, toast, progress, skeleton and the ' +
      'bug report form. Each one announces its message to assistive technology.',
  },
  data: {
    name: 'Data',
    icon: luTable,
    description:
      'The components that show many records at once: table, list, tree, calendar, chart and gantt. ' +
      'They take their rows from a state, and they sort, filter and select on the client.',
  },
}
