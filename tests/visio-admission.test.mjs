import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/visio.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports });
const { matchesLobbyAdmission, wasLobbyAdmissionDelivered } = module.exports;

test('lobby approval still matches when the WebRTC peer id has changed', () => {
  assert.equal(matchesLobbyAdmission({ toPeerId: 'old-peer', toParticipantId: 'guest-1' }, 'new-peer', 'guest-1'), true);
});

test('lobby approval does not admit a different participant', () => {
  assert.equal(matchesLobbyAdmission({ toPeerId: 'peer-2', toParticipantId: 'guest-2' }, 'peer-1', 'guest-1'), false);
});

test('one delivered admission signal is sufficient to admit the guest', () => {
  assert.equal(wasLobbyAdmissionDelivered('error', 'ok'), true);
  assert.equal(wasLobbyAdmissionDelivered('ok', 'timed out'), true);
});

test('the host keeps the guest waiting if both admission signals fail', () => {
  assert.equal(wasLobbyAdmissionDelivered('error', 'timed out'), false);
});
