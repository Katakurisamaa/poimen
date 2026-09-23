import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(overrides = {}) {
  const handlers = {};
  vm.runInNewContext(source, {
    URL, console,
    self: {
      location: { origin: 'https://poimen.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
      ...overrides.self,
    },
    caches: overrides.caches,
    fetch: overrides.fetch,
  });
  return handlers;
}

test('refresh never serves application scripts, styles, pages or data from the PWA cache', () => {
  const handlers = worker();
  for (const path of ['/_next/static/chunks/app.js', '/_next/static/css/app.css', '/dashboard', '/dashboard?_rsc=123', '/api/session', 'https://example.com/brand/icon-192.png']) {
    handlers.fetch({
      request: { method: 'GET', mode: path === '/dashboard' ? 'navigate' : 'cors', url: new URL(path, 'https://poimen.test').href },
      respondWith() { assert.fail(`Unexpected interception: ${path}`); },
    });
  }
});

test('activation deletes obsolete Poimen caches and preserves unrelated caches', async () => {
  const deleted = [];
  let claimed = false;
  const handlers = worker({
    caches: { keys: async () => ['poimen-v1', 'poimen-v2', 'other-app'], delete: async key => deleted.push(key) },
    self: { clients: { claim: async () => { claimed = true; } } },
  });
  let done;
  handlers.activate({ waitUntil: promise => { done = promise; } });
  await done;
  assert.deepEqual(deleted, ['poimen-v1']);
  assert.equal(claimed, true);
});

test('a failed branding precache does not prevent the fixed worker from activating', async () => {
  let skipped = false;
  const handlers = worker({
    caches: { open: async () => ({ addAll: async () => { throw new Error('offline'); } }) },
    self: { skipWaiting: async () => { skipped = true; } },
  });
  let done;
  handlers.install({ waitUntil: promise => { done = promise; } });
  await done;
  assert.equal(skipped, true);
});
