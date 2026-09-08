import { img, span } from '../../api/html.js'
import { bindValue } from './args.js'
import { token } from './css.js'

const initialsOf = (value) => {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words.at(-1)[0]]
  return letters.join('').toUpperCase()
}

export const avatarNode = (self, { name, picture }) => {
  const avatar = span({ class: 'avatar', 'aria-hidden': 'true' })
  if (picture === undefined || picture === null) {
    bindValue(self, name, (value) => {
      avatar.textContent = initialsOf(value)
    })
    return avatar
  }
  const picked = img({ alt: '' })
  bindValue(self, picture, (value) => picked.setAttribute('src', String(value)))
  avatar.append(picked)
  return avatar
}

export const avatarStyles = (size = '2rem') => `
  .avatar {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    inline-size: ${size};
    block-size: ${size};
    border-radius: 50%;
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: 1;
  }

  .avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
`
