import jwt from 'jsonwebtoken'

/**
 * Extract userId from optional Bearer token.
 * Returns userId string or null if not authenticated.
 */
export function optionalUserId(req) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
      return decoded.userId
    } catch { /* invalid token — treat as unauthenticated */ }
  }
  return null
}

/**
 * Parse and clamp pagination params from query string.
 */
export function parsePagination(query, defaults = {}) {
  const maxLimit = defaults.maxLimit || 100
  const defaultLimit = defaults.limit || 20
  const defaultPage = 1

  let limit = parseInt(query.limit, 10)
  if (isNaN(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  let page = parseInt(query.page, 10)
  if (isNaN(page) || page < 1) page = defaultPage

  const skip = (page - 1) * limit
  return { page, limit, skip }
}
