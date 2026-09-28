import {
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
      'The boxes that place other components: stack, flex, split pane, tabs, dialog and drawer. ' +
      'They own the spacing between their children, so a child carries no outer margin.',
  },
  inputs: {
    name: 'Inputs',
    icon: luTextCursorInput,
    description:
      'The form controls, from a text field to a date picker, an emoji picker and a rich text ' +
      'editor, and the form that validates them. Each control renders its own label and error message.',
  },
  display: {
    name: 'Display',
    icon: luEye,
    description:
      'The read-only surfaces that show content: card, tag, avatar, tooltip, accordion, code block, ' +
      'markdown, description list, empty state, steps and QR code. Nothing here takes input.',
  },
  shell: {
    name: 'Shell',
    icon: luLayoutDashboard,
    priority: 1,
    description:
      'The app frame and its parts: the shell, the logo, the breadcrumbs, the user card, the ' +
      'organization switcher, the notifications, and the language and theme menus. Each part is ' +
      'made for a slot of the shell.',
  },
  feedback: {
    name: 'Feedback',
    icon: luMessageSquareWarning,
    description:
      'The components that tell the reader what happened, and hear back: notice, toast, loader, ' +
      'progress, skeleton, the bug report form and reactions. Each one announces its message to ' +
      'assistive technology.',
  },
  data: {
    name: 'Data',
    icon: luTable,
    description:
      'The components that show many records at once: table, list, timeline, tree, calendar, chart ' +
      'and gantt. ' +
      'They take their rows from a state, and they sort, filter and select on the client.',
  },
}
