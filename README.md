# gui-now-sdk

The official SDK for [GUI](https://gui.now) — instant shareable HTML canvases via API.

HTML in, URL out. Every canvas gets real-time input sync, state persistence, and a built-in component library.

## Install

```bash
npm install gui-now-sdk
```

## Quick Start

```typescript
import { createGui } from 'gui-now-sdk'

const gui = createGui()

// HTML canvas
const canvas = await gui.create({
  html: '<h1 style="color:white">Hello World</h1>',
  title: 'My Dashboard'
})
console.log(canvas.url) // https://gui.now/abc123xyz

// Made without an account? Show this link to the person: it lets them sign in
// and keep the page in their library (works once).
if (canvas.claim_url) console.log(canvas.claim_url)

// Markdown canvas
const doc = await gui.create({
  markdown: '# Report\n\nShipped **3 features** this sprint.',
  title: 'Sprint Report'
})

// Mermaid diagram
const diagram = await gui.createDiagram(
  'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Ship it]',
  { title: 'Release Flow' }
)
```

## Pro API Key

```typescript
const gui = createGui({ apiKey: 'YOUR_PRO_KEY' })

const canvas = await gui.create({
  html: '<h1>Pro Canvas</h1>',
  expires: 'never',       // Pro pages never expire by default; any duration works
  password: 'team2026'    // password protection
})
```

## API

### `createGui(config?)`

Create a client instance.

```typescript
const gui = createGui({
  baseUrl: 'https://gui.now',  // default
  apiKey: 'YOUR_PRO_KEY',      // optional
  agent: 'Claude Code'         // optional: shown next to the page in the owner's library
})
```

### `gui.create(options)`

Create a new canvas.

| Option | Type | Description |
|--------|------|-------------|
| `html` | string | HTML content |
| `markdown` | string | Markdown (alternative to html) |
| `title` | string | Display name |
| `theme` | `'dark'` \| `'light'` | Theme for markdown |
| `expires` | string | `'30m'`, `'24h'`, `'7d'`... or `'never'`. Default and max depend on who's publishing (below) |
| `password` | string | Pro: password-protect |
| `frames` | array | Multi-tab: `[{html, label}]` |
| `agent` | string | Agent name shown in the owner's library, e.g. `'Claude Code'` |

Returns: `{ id, url, edit_token, expires_at, expires_clamped?, claim_url?, owned?, pro, format }`

| Publishing as | Default expiry | Longest |
|---|---|---|
| No account, no key | 24h | 72h |
| Signed-in free account | 72h | 7d |
| Pro key | never | no limit |

Asking for more than your tier allows isn't an error: the page gets the longest
allowed expiry and the response has `expires_clamped: true`. `expires_at` is
`null` when the page never expires. `claim_url` comes back for pages made
without an account or key; pass it on to the person you made the page for.

### `gui.createDiagram(mermaid, options?)`

Create a Mermaid diagram canvas.

```typescript
const { url } = await gui.createDiagram('graph TD\n  A-->B')
```

### `gui.update(id, editToken, options)`

Update a canvas. All viewers see changes in real-time. Send one of `html`,
`markdown` or `mermaid` to replace the body; anything you leave out, password
and expiry included, stays as it is.

```typescript
await gui.update(canvas.id, canvas.edit_token, {
  html: '<h1>Updated!</h1>'
})

// Replace the body with Markdown and check what went live
const r = await gui.update(canvas.id, canvas.edit_token, {
  markdown: '# Release notes\n\n- Faster sync',
  theme: 'light',
})
r.changed       // ['html']
r.content_hash  // 'sha256:…', same as X-Content-Hash on /embed/<id>
```

`ignored` lists any fields the API didn't apply. To change when a page
expires, use `extend`. Free: 3 edits. Pro: unlimited.

### `gui.extend(id, options?)`

Push a page's expiry forward.

```typescript
// +24h. Pages without an owner stop at 72h after they were made.
await gui.extend(canvas.id)

// A specific expiry, measured from now and clamped to the page's tier
await gui.extend(canvas.id, { editToken: canvas.edit_token, expires: '72h' })
```

Pages in someone's library need the edit token (or the owner signed in on
gui.now). Once an unowned page reaches its 72h ceiling, `extend` throws a
`GuiError` with `status` 409 and `maxExpiresAt`.

### Errors

Every failed call throws a `GuiError` (a subclass of `Error`) with the HTTP
`status` and the response `body`.

### `gui.subscribe(id, callback)`

Listen for real-time updates via SSE.

```typescript
const unsubscribe = gui.subscribe(canvas.id, (data) => {
  console.log('Updated:', data.html)
})
unsubscribe() // stop listening
```

## Components

Every canvas gets 8 auto-injected components. Use them in HTML or Markdown:

```html
<gui-chart type="bar" data='[{"label":"Q1","value":42}]'></gui-chart>
<gui-table data='[{"name":"Alice","role":"Eng"}]'></gui-table>
<gui-card title="Users" value="12,847" change="+12%"></gui-card>
<gui-code language="python">print("hello")</gui-code>
<gui-kanban columns='[{"title":"Todo","items":["Task 1"]}]'></gui-kanban>
<gui-timeline data='[{"date":"Mar 1","title":"Launch"}]'></gui-timeline>
<gui-form fields='[{"name":"email","type":"email","label":"Email"}]'></gui-form>
<gui-grid columns="3">...</gui-grid>
```

## Limits

| | Free | Pro |
|---|---|---|
| Size | 2 MB | 10 MB |
| Expiry | 24 hours | Up to 30 days |
| Edits | 3 | Unlimited |
| Rate | 5/hr | 100/hr |
| Password | — | ✓ |
| Watermark | GUI badge | None |

Free tier: no account or API key needed.

## Links

- [GUI](https://gui.now)
- [API Docs](https://gui.now/docs)
- [Pro](https://gui.now/pro)
- [Agent Skill](https://github.com/gui-now/skills) — `npx skills add gui-now/skills --skill gui-now -g`

## License

MIT
