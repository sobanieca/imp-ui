import { img, span } from '../../api/html.js'
import { bindValue } from './args.js'
import { token } from './css.js'

const initialsOf = (value) => {
  const words = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words.at(-1)[0]]
  return letters.join('').toUpperCase()
}

const isMissing = (value) => value === undefined || value === null || value === ''

const pictureNode = (self, picture, initials) => {
  const picked = img({ class: 'picture', alt: '' })
  const show = (visible) => {
    picked.hidden = !visible
    initials.hidden = visible
  }
  picked.addEventListener('error', () => show(false))
  bindValue(self, picture, (value) => {
    if (isMissing(value)) {
      picked.removeAttribute('src')
      return show(false)
    }
    picked.setAttribute('src', String(value))
    show(true)
  })
  return picked
}

const nameAvatar = (self, avatar, name, decorative) => {
  if (decorative) return avatar.setAttribute('aria-hidden', 'true')
  avatar.setAttribute('role', 'img')
  bindValue(self, name, (value) => avatar.setAttribute('aria-label', String(value ?? '')))
}

export const avatarNode = (self, { name, picture, decorative = true, classes = [] }) => {
  const initials = span({ class: 'initials' })
  bindValue(self, name, (value) => {
    initials.textContent = initialsOf(value)
  })
  const avatar = span({ class: ['avatar', ...classes] }, initials)
  if (picture !== undefined && picture !== null) avatar.append(pictureNode(self, picture, initials))
  nameAvatar(self, avatar, name, decorative)
  return avatar
}

export const avatarStyles = () => `
  .avatar {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    inline-size: var(--avatar-size, 2rem);
    block-size: var(--avatar-size, 2rem);
    border-radius: 50%;
    background-color: var(--avatar-fill, ${token('color-primary')});
    color: var(--avatar-ink, ${token('color-on-primary')});
    font-size: var(--avatar-font-size, ${token('font-size-sm')});
    font-weight: ${token('font-weight-bold')};
    line-height: 1;
  }

  .avatar [hidden] {
    display: none;
  }

  .avatar .picture {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  @media (forced-colors: active) {
    .avatar {
      border: ${token('border-width')} solid CanvasText;
      box-sizing: border-box;
    }
  }
`
