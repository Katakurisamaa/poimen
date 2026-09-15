import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'lib/attendance.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const fixtureModule = { exports: {} };
vm.runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports });
const { buildAttendanceUpdate, getAttendanceStatus, usesExplicitAttendance } = fixtureModule.exports;

const activity = 'culte';
const date = '2026-09-13';

test('an untouched member remains unpointed', () => {
  assert.equal(getAttendanceStatus({}, activity, date), 'unpointed');
});

test('presence records the selected service and clears an old absence reason', () => {
  const initial = { _comments: { culte: { [date]: 'Maladie' } } };
  const next = buildAttendanceUpdate(initial, activity, date, 'present', '', 'culte_2');
  assert.equal(next.culte[date], 'culte_2');
  assert.equal(next._attendance_status.culte[date], 'present');
  assert.equal(next._comments.culte[date], undefined);
});

test('a justified absence stores an explicit status and reason', () => {
  const next = buildAttendanceUpdate({}, activity, date, 'justified', 'Travail');
  assert.equal(next.culte[date], false);
  assert.equal(getAttendanceStatus(next, activity, date), 'justified');
  assert.equal(next._comments.culte[date], 'Travail');
});

test('an unjustified absence does not keep a misleading reason', () => {
  const initial = buildAttendanceUpdate({}, activity, date, 'justified', 'Voyage');
  const next = buildAttendanceUpdate(initial, activity, date, 'unjustified');
  assert.equal(getAttendanceStatus(next, activity, date), 'unjustified');
  assert.equal(next._comments.culte[date], undefined);
});

test('legacy comments remain compatible as justified absences', () => {
  const legacy = { _comments: { culte: { [date]: 'Maladie' } } };
  assert.equal(getAttendanceStatus(legacy, activity, date), 'justified');
  assert.equal(usesExplicitAttendance(legacy, [activity], date), false);
});
