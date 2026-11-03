import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createGui, GuiError } from '../src/index.ts'

type Call = { url: string; init: RequestInit }
let calls: Call[] = []
let reply: () => Response

beforeEach(() => {
  calls = []
  reply = () => Response.json({})
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return reply()
  }) as typeof fetch
})

const hdr = (c: Call) => c.init.headers as Record<string, string>

test('create sends x-gui-client and returns claim_url and null expiry', async () => {
  reply = () =>
    Response.json(
      { id: 'abc', url: 'https://gui.now/abc', edit_token: 't', expires_at: null, claim_url: 'https://gui.now/claim/abc#token=x' },
      { status: 201 }
    )
  const gui = createGui({ baseUrl: 'http://x' })
  const c = await gui.create({ html: '<p>hi</p>' })
  assert.equal(c.claim_url, 'https://gui.now/claim/abc#token=x')
  assert.equal(c.expires_at, null)
  assert.equal(calls[0].url, 'http://x/api/canvas')
  assert.equal(hdr(calls[0])['x-gui-client'], 'gui-now-sdk')
  assert.equal(hdr(calls[0])['x-api-key'], undefined)
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { html: '<p>hi</p>' })
})

test('create passes expires, the config agent, and a per-call agent override', async () => {
  const gui = createGui({ baseUrl: 'http://x', apiKey: 'k', agent: 'Claude Code' })
  await gui.create({ html: 'a', expires: 'never' })
  await gui.create({ html: 'b', expires: '7d', agent: 'Cursor' })
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { html: 'a', expires: 'never', agent: 'Claude Code' })
  assert.deepEqual(JSON.parse(calls[1].init.body as string), { html: 'b', expires: '7d', agent: 'Cursor' })
  assert.equal(hdr(calls[0])['x-api-key'], 'k')
})

test('extend with no options sends no token and no body (old behavior)', async () => {
  reply = () => Response.json({ id: 'abc', expires_at: '2026-11-04T00:00:00Z', extended: true })
  const gui = createGui({ baseUrl: 'http://x' })
  const r = await gui.extend('abc')
  assert.equal(r.extended, true)
  assert.equal(calls[0].url, 'http://x/api/canvas/abc/extend')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(hdr(calls[0]).Authorization, undefined)
  assert.equal(calls[0].init.body, undefined)
})

test('extend with editToken and expires sends Bearer and body', async () => {
  reply = () => Response.json({ id: 'abc', expires_at: null, extended: true, expires_clamped: true })
  const gui = createGui({ baseUrl: 'http://x' })
  const r = await gui.extend('abc', { editToken: 'tok', expires: 'never' })
  assert.equal(hdr(calls[0]).Authorization, 'Bearer tok')
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { expires: 'never' })
  assert.equal(r.expires_at, null)
  assert.equal(r.expires_clamped, true)
})

test('extend past the 72h ceiling throws GuiError with status and maxExpiresAt', async () => {
  reply = () =>
    Response.json({ error: 'This page cannot be extended further.', max_expires_at: '2026-11-06T00:00:00Z' }, { status: 409 })
  const gui = createGui({ baseUrl: 'http://x' })
  await assert.rejects(gui.extend('abc'), (e: unknown) => {
    assert.ok(e instanceof GuiError)
    assert.equal(e.status, 409)
    assert.equal(e.maxExpiresAt, '2026-11-06T00:00:00Z')
    assert.equal(e.message, 'This page cannot be extended further.')
    return true
  })
})

test('errors without a JSON body fall back to the status text', async () => {
  reply = () => new Response('nope', { status: 500, statusText: 'Internal Server Error' })
  const gui = createGui({ baseUrl: 'http://x' })
  await assert.rejects(gui.update('abc', 't', { html: 'x' }), (e: unknown) => {
    assert.ok(e instanceof GuiError)
    assert.equal(e.status, 500)
    assert.equal(e.message, 'Internal Server Error')
    return true
  })
})

test('ids are URL-encoded', async () => {
  const gui = createGui({ baseUrl: 'http://x' })
  await gui.extend('a/b')
  assert.equal(calls[0].url, 'http://x/api/canvas/a%2Fb/extend')
})

test('extend with expires but no editToken fails before calling the API', async () => {
  const gui = createGui({ baseUrl: 'http://x' })
  await assert.rejects(gui.extend('abc', { expires: '7d' }), /pass editToken/)
  assert.equal(calls.length, 0)
})
