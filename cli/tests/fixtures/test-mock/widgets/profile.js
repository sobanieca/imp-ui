import { get } from '../http.js'
import { formatUser } from '../format.js'

export const loadProfile = async () => formatUser(await get('/me'))
