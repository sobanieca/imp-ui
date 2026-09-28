# Accessibility - the one gap left in the contract

`adr/accessible-by-default-stdlib.md` records the accessibility contract of the standard library.
One component still breaks it.

- **Fix: `calendar` has no keyboard path to a slot at a chosen time.** A click on an empty column
  creates a slot at that time. From the keyboard, the day button creates an all-day slot only. That
  breaks the rule that every pointer interaction has a keyboard equivalent. In the day view and the
  week view, the arrow keys move the focus across the time slots. Enter creates a slot at the
  focused time. Add a case to `lib/test/keyboard.spec.js`. When it lands, delete this file.
