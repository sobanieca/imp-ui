import {
  luCompass,
  luEye,
  luLayoutDashboard,
  luLayoutTemplate,
  luMessageSquareWarning,
  luShapes,
  luTextCursorInput,
} from 'imp/icons'

export const groups = [
  { name: 'General', icon: luShapes },
  { name: 'Layout', icon: luLayoutTemplate },
  { name: 'Inputs', icon: luTextCursorInput },
  { name: 'Display', icon: luEye },
  { name: 'Navigation', icon: luCompass },
  { name: 'Shell', icon: luLayoutDashboard },
  { name: 'Feedback', icon: luMessageSquareWarning },
]
