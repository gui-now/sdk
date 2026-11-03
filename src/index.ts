/**
 * A duration like "30m", "24h" or "7d", or "never".
 *
 * The server applies the caller's tier limits (anonymous 72h max, free
 * account 7d max, Pro key no limit) and clamps longer requests instead of
 * rejecting them; the response then carries `expires_clamped: true`.
 */
export type Expires = `${number}m` | `${number}h` | `${number}d` | 'never'

export interface CreateOptions {
  /** Raw HTML content */
  html?: string
  /** Markdown content (server-rendered with syntax highlighting) */
  markdown?: string
  /** Display title for toolbar and OG meta */
  title?: string
  /** Theme for markdown rendering */
  theme?: 'dark' | 'light'
  /**
   * How long until the page expires. Defaults: 24h anonymous, 72h with a free
   * account, never with a Pro key. Requests past your tier's max are clamped.
   */
  expires?: Expires
  /** Password-protect the canvas (Pro only) */
  password?: string
  /** Multi-tab views */
  frames?: { html: string; label?: string }[]
  /**
   * Name of the agent publishing the page, e.g. "Claude Code". Shown in the
   * owner's library next to the page. A label only, never used for auth.
   */
  agent?: string
}

export interface UpdateOptions {
  html?: string
  title?: string
  frames?: { html: string; label?: string }[]
  /** Set or remove password (Pro only). null to remove. */
  password?: string | null
}

export interface ExtendOptions {
  /**
   * The page's edit token. Needed to ask for a specific `expires`; without it
   * an unowned page gets +24h, up to 72h after it was created.
   */
  editToken?: string
  /** New expiry measured from now, clamped to the page's tier max. */
  expires?: Expires
}

export interface Canvas {
  id: string
  url: string
  edit_token: string
  /** ISO timestamp, or null when the page never expires. */
  expires_at: string | null
  /** True when the requested `expires` was longer than your tier allows. */
  expires_clamped?: boolean
  /**
   * For pages made without an account or Pro key: a link a person opens to
   * sign in and keep the page in their library. Show it to the human; it
   * works once. Only returned on create.
   */
  claim_url?: string
  /** True when the page was created into a signed-in account. */
  owned?: boolean
  password_protected?: boolean
  pro?: boolean
  format?: string
}

export interface ExtendResult {
  id: string
  /** ISO timestamp, or null when the page never expires. */
  expires_at: string | null
  extended: boolean
  expires_clamped?: boolean
}

export interface GuiConfig {
  baseUrl?: string
  /** Pro API key */
  apiKey?: string
  /**
   * Default agent name sent with every create (see CreateOptions.agent).
   * A per-call `agent` wins.
   */
  agent?: string
}

/** An error response from the GUI API, with its HTTP status. */
export class GuiError extends Error {
  readonly status: number
  /** On a 409 from extend: the latest expiry this page can reach. */
  readonly maxExpiresAt?: string
  readonly body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    const message = typeof body.error === 'string' && body.error ? body.error : `HTTP ${status}`
    super(message)
    this.name = 'GuiError'
    this.status = status
    this.body = body
    if (typeof body.max_expires_at === 'string') this.maxExpiresAt = body.max_expires_at
  }
}

const DEFAULT_BASE = 'https://gui.now'
// Lets the owner's library show "SDK" as the page's source.
const CLIENT = 'gui-now-sdk'

async function check<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new GuiError(res.status, body && typeof body === 'object' ? body : {})
  }
  return res.json() as Promise<T>
}

export function createGui(config: GuiConfig = {}) {
  const base = config.baseUrl || DEFAULT_BASE
  const apiKey = config.apiKey

  function headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', 'x-gui-client': CLIENT }
    if (apiKey) h['x-api-key'] = apiKey
    if (extra) Object.assign(h, extra)
    return h
  }

  return {
    async create(options: CreateOptions): Promise<Canvas> {
      const agent = options.agent ?? config.agent
      const res = await fetch(`${base}/api/canvas`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(agent ? { ...options, agent } : options),
      })
      return check<Canvas>(res)
    },

    async createDiagram(mermaid: string, options?: { title?: string; theme?: 'dark' | 'light' }): Promise<Canvas> {
      const res = await fetch(`${base}/api/flow`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ mermaid, ...options }),
      })
      return check<Canvas>(res)
    },

    async update(id: string, editToken: string, options: UpdateOptions): Promise<{ id: string; updated: boolean; edit_count?: number; edits_remaining?: number }> {
      const res = await fetch(`${base}/api/canvas/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: headers({ Authorization: `Bearer ${editToken}` }),
        body: JSON.stringify(options),
      })
      return check(res)
    },

    /**
     * Push a page's expiry forward. With no options: +24h (unowned pages stop
     * at 72h after creation; past that the API answers 409 and the GuiError
     * carries maxExpiresAt). Pass the edit token to ask for a specific
     * `expires`, clamped to the page's tier max.
     */
    async extend(id: string, options: ExtendOptions = {}): Promise<ExtendResult> {
      // The API ignores `expires` without auth and just adds 24h; say so here.
      if (options.expires !== undefined && !options.editToken) {
        throw new Error('extend: pass editToken to choose an expiry; without it extend adds 24h')
      }
      const extra: Record<string, string> = {}
      if (options.editToken) extra.Authorization = `Bearer ${options.editToken}`
      const res = await fetch(`${base}/api/canvas/${encodeURIComponent(id)}/extend`, {
        method: 'POST',
        headers: headers(extra),
        ...(options.expires !== undefined ? { body: JSON.stringify({ expires: options.expires }) } : {}),
      })
      return check<ExtendResult>(res)
    },

    subscribe(id: string, onUpdate: (data: { html?: string; title?: string; frames?: unknown }) => void) {
      const evtSource = new EventSource(`${base}/api/canvas/${encodeURIComponent(id)}/events`)

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
