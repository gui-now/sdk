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
  expires: '14d',         // up to 30 days
  password: 'team2026'    // password protection
})
```

## API

### `createGui(config?)`

Create a client instance.

```typescript
const gui = createGui({
  baseUrl: 'https://gui.now',  // default
  apiKey: 'YOUR_PRO_KEY'       // optional
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
| `expires` | string | Pro: `'1h'` `'24h'` `'7d'` `'14d'` `'30d'` |
| `password` | string | Pro: password-protect |
| `frames` | array | Multi-tab: `[{html, label}]` |

Returns: `{ id, url, edit_token, expires_at, pro, format }`

### `gui.createDiagram(mermaid, options?)`

Create a Mermaid diagram canvas.

```typescript
const { url } = await gui.createDiagram('graph TD\n  A-->B')
```

### `gui.update(id, editToken, options)`

Update a canvas. All viewers see changes in real-time.

```typescript
await gui.update(canvas.id, canvas.edit_token, {
  html: '<h1>Updated!</h1>'
})
```

Free: 3 edits. Pro: unlimited.

### `gui.extend(id)`

Extend canvas expiry by 24 hours.

```typescript
await gui.extend(canvas.id)
```

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
