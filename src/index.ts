export interface CreateOptions {
  /** Raw HTML content */
  html?: string
  /** Markdown content (server-rendered with syntax highlighting) */
  markdown?: string
  /** Display title for toolbar and OG meta */
  title?: string
  /** Theme for markdown rendering */
  theme?: 'dark' | 'light'
  /** Expiry duration (Pro only) */
  expires?: '1h' | '24h' | '7d' | '14d' | '30d'
  /** Password-protect the canvas (Pro only) */
  password?: string
  /** Multi-tab views */
  frames?: { html: string; label?: string }[]
}

export interface UpdateOptions {
  html?: string
  title?: string
  frames?: { html: string; label?: string }[]
  /** Set or remove password (Pro only). null to remove. */
  password?: string | null
}

export interface Canvas {
  id: string
  url: string
  edit_token: string
  expires_at: string
  pro?: boolean
  format?: string
}

export interface GuiConfig {
  baseUrl?: string
  /** Pro API key */
  apiKey?: string
}

const DEFAULT_BASE = 'https://gui.now'

export function createGui(config: GuiConfig = {}) {
  const base = config.baseUrl || DEFAULT_BASE
  const apiKey = config.apiKey

  function headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) h['x-api-key'] = apiKey
    if (extra) Object.assign(h, extra)
    return h
  }

  return {
    async create(options: CreateOptions): Promise<Canvas> {
      const res = await fetch(`${base}/api/canvas`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return res.json()
    },

    async createDiagram(mermaid: string, options?: { title?: string; theme?: 'dark' | 'light' }): Promise<Canvas> {
      const res = await fetch(`${base}/api/flow`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ mermaid, ...options }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return res.json()
    },

    async update(id: string, editToken: string, options: UpdateOptions): Promise<{ id: string; updated: boolean; edit_count?: number; edits_remaining?: number }> {
      const res = await fetch(`${base}/api/canvas/${id}`, {
        method: 'PUT',
        headers: headers({ Authorization: `Bearer ${editToken}` }),
        body: JSON.stringify(options),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return res.json()
    },

    async extend(id: string): Promise<{ id: string; expires_at: string; extended: boolean }> {
      const res = await fetch(`${base}/api/canvas/${id}/extend`, {
        method: 'POST',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return res.json()
    },

    subscribe(id: string, onUpdate: (data: { html?: string; title?: string; frames?: unknown }) => void) {
      const evtSource = new EventSource(`${base}/api/canvas/${id}/events`)

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'update') {
            onUpdate(data)
          }
        } catch {
          // ignore
        }
      }

      return () => evtSource.close()
    },
  }
}

// Convenience: default instance
const gui = createGui()

export { gui }
export default gui
