import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('invitation notice distinguishes this computer, insecure LAN and public HTTPS', () => {
  const code = ts.transpileModule(fs.readFileSync(new URL('../lib/visio.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL });
  const { getVisioLinkNotice } = module.exports;
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
    assert.match(getVisioLinkNotice(`${origin}/visio?room=test`), /uniquement sur cet ordinateur/);
  }
  assert.match(getVisioLinkNotice('http://192.168.1.21:3000/visio'), /HTTPS/);
  assert.equal(getVisioLinkNotice('https://example.org/visio?room=test'), null);
  assert.equal(getVisioLinkNotice('/visio?room=test'), null);
});

test('document policy permits same-origin calls after direct load or client navigation', async () => {
  const source = fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports });
  const rules = await module.exports.default.headers();
  const policy = rules.find(rule => rule.source === '/:path*')?.headers
    .find(header => header.key.toLowerCase() === 'permissions-policy')?.value;
  assert.ok(policy, 'Every entry document needs a media policy, including dashboard entry routes');
  for (const feature of ['camera', 'microphone']) {
    assert.match(policy, new RegExp(`${feature}=\\(self\\)`));
  }
  assert.match(policy, /geolocation=\(\)/);
});
