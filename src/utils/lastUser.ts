const STORAGE_KEY = 'authentik-demo:last-user'

export interface LastUserProfile {
  email?: string
  name?: string
}

export function saveLastUser(profile: LastUserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // localStorage 不可用時（例如無痕模式）直接略過，不影響登入流程
  }
}

export function getLastUser(): LastUserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LastUserProfile) : null
  } catch {
    return null
  }
}

export function clearLastUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
