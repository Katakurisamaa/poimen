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
const {
  buildAttendanceUpdate,
  getAttendanceStatus,
  usesExplicitAttendance,
  isCulteActivity,
  isOnlineAttendance,
  isPresentialCulteService,
  isPresentialAttendance
} = fixtureModule.exports;

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

test('clearing a justified absence makes the member unpointed and removes the reason', () => {
  const initial = buildAttendanceUpdate({}, activity, date, 'justified', 'Famille');
  const next = buildAttendanceUpdate(initial, activity, date, 'unpointed');
  assert.equal(getAttendanceStatus(next, activity, date), 'unpointed');
  assert.equal(next.culte[date], false);
  assert.equal(next._comments.culte[date], undefined);
  assert.equal(getAttendanceStatus(initial, activity, date), 'justified');
});

test('undoing a correction restores the original absence reason', () => {
  const initial = buildAttendanceUpdate({}, activity, date, 'justified', 'Rendez-vous familial');
  const previousStatus = getAttendanceStatus(initial, activity, date);
  const previousReason = initial._comments.culte[date];
  const corrected = buildAttendanceUpdate(initial, activity, date, 'present', '', 'culte_en_ligne');
  const restored = buildAttendanceUpdate(corrected, activity, date, previousStatus, previousReason);
  assert.equal(getAttendanceStatus(restored, activity, date), 'justified');
  assert.equal(restored._comments.culte[date], 'Rendez-vous familial');
  assert.equal(restored.culte[date], false);
});

test('undo restores the original service even when the active service changed', () => {
  const initial = buildAttendanceUpdate({}, activity, date, 'present', '', 'culte_2');
  const corrected = buildAttendanceUpdate(initial, activity, date, 'unjustified');
  const restored = buildAttendanceUpdate(corrected, activity, date, 'present', '', initial.culte[date]);
  assert.equal(restored.culte[date], 'culte_2');
  assert.equal(getAttendanceStatus(restored, activity, date), 'present');
});

test('pointing and undoing leave other dates and activities intact', () => {
  const otherDate = '2026-09-06';
  let attendance = buildAttendanceUpdate({}, activity, otherDate, 'justified', 'Travail');
  attendance = buildAttendanceUpdate(attendance, 'cdm', date, 'present');
  const initial = JSON.stringify(attendance);
  const pointed = buildAttendanceUpdate(attendance, activity, date, 'present', '', 'culte_1');
  const restored = buildAttendanceUpdate(pointed, activity, date, 'unpointed');
  assert.equal(getAttendanceStatus(restored, activity, otherDate), 'justified');
  assert.equal(restored._comments.culte[otherDate], 'Travail');
  assert.equal(getAttendanceStatus(restored, 'cdm', date), 'present');
  assert.equal(JSON.stringify(attendance), initial);
});

test('presence records culte_1_2 for participant attending both services', () => {
  const initial = { _comments: { culte: { [date]: 'Voyage' } } };
  const next = buildAttendanceUpdate(initial, activity, date, 'present', '', 'culte_1_2');
  assert.equal(next.culte[date], 'culte_1_2');
  assert.equal(next._attendance_status.culte[date], 'present');
  assert.equal(getAttendanceStatus(next, activity, date), 'present');
  assert.equal(next._comments.culte[date], undefined);
});

test('isPresentialAttendance marks culte 1, 2, and dual service as present, but excludes online', () => {
  assert.equal(isCulteActivity('culte', 'Culte du dimanche'), true);
  assert.equal(isCulteActivity('cdm', 'Cellule de maison'), false);

  // Online attendances are recognized as online
  assert.equal(isOnlineAttendance('en_ligne'), true);
  assert.equal(isOnlineAttendance('culte_en_ligne'), true);
  assert.equal(isOnlineAttendance('online'), true);
  assert.equal(isOnlineAttendance('culte_1'), false);

  // In Culte, only presential services (culte 1, culte 2, dual service, true) are considered presential
  assert.equal(isPresentialAttendance('culte_1', true), true);
  assert.equal(isPresentialAttendance('culte_2', true), true);
  assert.equal(isPresentialAttendance('culte_1_2', true), true);
  assert.equal(isPresentialAttendance('culte_1_et_2', true), true);
  assert.equal(isPresentialAttendance('culte_both', true), true);
  assert.equal(isPresentialAttendance('both', true), true);
  assert.equal(isPresentialAttendance(true, true), true);

  // Online Culte attendance MUST be false for presential attendance
  assert.equal(isPresentialAttendance('en_ligne', true), false);
  assert.equal(isPresentialAttendance('culte_en_ligne', true), false);
  assert.equal(isPresentialAttendance('online', true), false);

  // Unpointed or absent are false
  assert.equal(isPresentialAttendance(false, true), false);
  assert.equal(isPresentialAttendance(undefined, true), false);
  assert.equal(isPresentialAttendance(null, true), false);

  // Non-culte activities count truthy values as present
  assert.equal(isPresentialAttendance(true, false), true);
  assert.equal(isPresentialAttendance('present', false), true);
  assert.equal(isPresentialAttendance(false, false), false);
});

