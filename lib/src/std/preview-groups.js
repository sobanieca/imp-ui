import {
  luCompass,
  luEye,
  luLayoutDashboard,
  luLayoutTemplate,
  luMessageSquareWarning,
  luShapes,
  luTextCursorInput,
} from 'imp/icons'

export const groups = {
  general: { name: 'General', icon: luShapes },
  layout: { name: 'Layout', icon: luLayoutTemplate },
  inputs: { name: 'Inputs', icon: luTextCursorInput },
  display: { name: 'Display', icon: luEye },
  navigation: { name: 'Navigation', icon: luCompass },
  shell: { name: 'Shell', icon: luLayoutDashboard, priority: 1 },
  feedback: { name: 'Feedback', icon: luMessageSquareWarning },
}
