const FIRST_NAMES = [
  'Ada',
  'Amir',
  'Anna',
  'Carlos',
  'Chloe',
  'Daniel',
  'Elena',
  'Emma',
  'Hana',
  'Ivan',
  'James',
  'Julia',
  'Kofi',
  'Lars',
  'Lucia',
  'Maria',
  'Mateo',
  'Mei',
  'Noah',
  'Olivia',
  'Omar',
  'Priya',
  'Sara',
  'Tom',
  'Yuki',
  'Zofia',
]

const LAST_NAMES = [
  'Becker',
  'Brown',
  'Chen',
  'Costa',
  'Dubois',
  'Garcia',
  'Haddad',
  'Jensen',
  'Kim',
  'Kowalski',
  'Larsen',
  'Mensah',
  'Miller',
  'Novak',
  'Nowak',
  'Okafor',
  'Patel',
  'Rossi',
  'Silva',
  'Smith',
  'Tanaka',
  'Weber',
  'Wilson',
  'Young',
]

const EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net']

const AREA_CODES = ['201', '212', '305', '312', '415', '503', '617', '702', '808', '917']

const STREET_NAMES = [
  'Oak',
  'Maple',
  'Cedar',
  'Elm',
  'Pine',
  'Birch',
  'Willow',
  'Lake',
  'Hill',
  'Park',
  'Mill',
  'River',
]

const STREET_KINDS = ['Street', 'Avenue', 'Road', 'Lane', 'Way']

const CITIES = [
  ['Austin', 'United States'],
  ['Bristol', 'United Kingdom'],
  ['Krakow', 'Poland'],
  ['Lisbon', 'Portugal'],
  ['Lyon', 'France'],
  ['Melbourne', 'Australia'],
  ['Munich', 'Germany'],
  ['Osaka', 'Japan'],
  ['Toronto', 'Canada'],
  ['Valencia', 'Spain'],
]

const HEX = '0123456789abcdef'

const randomInt = (below) => Math.floor(Math.random() * below)

const pick = (items) => items[randomInt(items.length)]

const digits = (count) => Array.from({ length: count }, () => randomInt(10)).join('')

const hexDigits = (count) => Array.from({ length: count }, () => HEX[randomInt(16)]).join('')

const emailPart = (word) =>
  word
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const guid = () => {
  const variant = HEX[8 + randomInt(4)]
  return `${hexDigits(8)}-${hexDigits(4)}-4${hexDigits(3)}-${variant}${hexDigits(3)}-${hexDigits(12)}`
}

const name = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`

const email = (person = name()) => {
  if (typeof person !== 'string' || person.trim() === '') {
    throw new Error(
      "imp: fake.email(name) - name must be a person's name, like 'Ada Smith', or nothing",
    )
  }
  const local = person.trim().split(/\s+/).map(emailPart).filter(Boolean).join('.') || 'person'
  return `${local}${1 + randomInt(99)}@${pick(EMAIL_DOMAINS)}`
}

const phone = () => `+1 ${pick(AREA_CODES)} 555 01${digits(2)}`

const hash = (length = 32) => {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('imp: fake.hash(length) - length must be a whole number of 1 or more')
  }
  return hexDigits(length)
}

const address = () => {
  const [city, country] = pick(CITIES)
  return {
    street: `${1 + randomInt(250)} ${pick(STREET_NAMES)} ${pick(STREET_KINDS)}`,
    city,
    postalCode: digits(5),
    country,
  }
}

export const fake = Object.freeze({ guid, name, email, phone, hash, address })
