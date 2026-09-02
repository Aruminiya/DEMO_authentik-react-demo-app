export function decodeJwt(token?: string | null): Record<string, unknown> | null {
  if (!token) {
    return null
  }

  const parts = token.split('.')

  if (parts.length !== 3) {
    return null
  }

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )

    return JSON.parse(json)
  } catch {
    return null
  }
}
