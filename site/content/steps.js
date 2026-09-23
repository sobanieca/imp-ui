export const steps = [
  {
    title: 'Define the app map',
    text: 'Name every screen, its path and its purpose in one file. imp map prints the tree, so ' +
      'the plan is visible before the first component exists.',
    command: 'imp map',
  },
  {
    title: 'Ask your agent to generate the app',
    text:
      'Point the agent at imp skill. It reads the manual of what it is about to write, at the ' +
      'version that the project runs, and it builds the screens from the map.',
    command: 'imp skill',
  },
  {
    title: 'Review the design against mocked clients',
    text: 'Ask for mocked HTTP clients, so the whole app runs with no backend. Click through it. ' +
      'Leave a note on any element with the review widget, and hand the notes to the agent.',
    command: 'imp start --mock',
  },
  {
    title: 'Build the backend when the frontend is approved',
    text: 'The stakeholders sign off on an app that they can click. Then the backend implements ' +
      'the contract that the mocks describe, and imp build ships the frontend to a CDN.',
    command: 'imp build',
  },
]

export const stepsNote =
  'Iterate from whichever step you want. A new screen starts at the map. A design change starts ' +
  'at the review. A changed contract starts at the mocks.'
