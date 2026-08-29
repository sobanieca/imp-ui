import { userCard } from 'imp/std/shell'

export const name = 'UserCard'
export const category = 'Shell'
export const description =
  "Run 'imp skill std/userCard' to learn what userCard can do before using it."

const picture = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%237c9cff"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M4 22a8 8 0 0116 0z" fill="white"/></svg>',
  )

export const initialsOnly = userCard({ name: 'Ada Lovelace' })
export const withAnEmail = userCard({ name: 'Ada Lovelace', description: 'ada@example.com' })
export const withAPicture = userCard({
  name: 'Ada Lovelace',
  description: 'Owner',
  picture,
})
export const linkedToTheAccountPage = userCard({
  name: 'Ada Lovelace',
  description: 'ada@example.com',
  href: '/account',
})
export const compactForARail = userCard({ name: 'Ada Lovelace', compact: true, picture })
export const aLongName = userCard({
  name: 'Augusta Ada King-Noel, Countess of Lovelace',
  description: 'ada.king-noel@a-very-long-domain-name.example.com',
})
