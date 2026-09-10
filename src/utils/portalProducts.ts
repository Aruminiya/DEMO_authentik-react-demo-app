export interface PortalProduct {
  name: string
  url: string
}

// VITE_PORTAL_PRODUCTS is a comma-separated list of plain URLs (no per-product
// name field) — the display name is derived from the URL's host (e.g.
// "localhost:5175"). Each entry is validated independently, so one malformed
// URL is dropped rather than invalidating the whole list.
export function getPortalProducts(): PortalProduct[] {
  const raw = import.meta.env.VITE_PORTAL_PRODUCTS
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        return [{ name: new URL(entry).host, url: entry }]
      } catch {
        return []
      }
    })
}
