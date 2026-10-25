import { appMap } from 'imp'

const admin = appMap(
  { description: 'The back office' },
  { orgs: { $orgId: { teams: { $orgId: 'The team of an organization' } } } },
)

export const app = appMap({
  home: 'The welcome page',
  orgs: {
    $id: {
      teams: { $id: { members: {} } },
      settings: {},
    },
  },
  people: { $orgId: { $personId: {} } },
  admin,
})
