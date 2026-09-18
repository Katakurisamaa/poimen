import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(name) {
  const source = fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams, require: name => load(name.replace('./', '')) });
  return module.exports;
}
const { getNavigation, isNavigationActive } = load('navigation');
const { summarizePerson } = load('person-summary');
const { buildAttendanceUpdate } = load('attendance');

test('role navigation keeps room for Plus and limits management links', () => {
  for (const role of ['berger', 'second_du_berger', 'responsable', 'brebi', 'conseiller', 'integration_responsable', 'integration_second', 'integration_conseiller']) {
    const nav = getNavigation({ role, hasFamily: !role.startsWith('integration_') });
    assert.ok(nav.primary.length <= 4, role);
    assert.ok([...nav.primary, ...nav.secondary].every(item => !item.href.includes('/admin')));
    const team = nav.secondary.some(item => item.href === '/dashboard/equipe');
    assert.equal(team, ['integration_responsable', 'integration_second'].includes(role));
  }
  assert.equal(getNavigation({ role: 'berger', hasFamily: false }).primary.length, 0);
});

test('active navigation distinguishes admin tabs and grouped people routes', () => {
  const admin = getNavigation({ role: 'super_admin', hasFamily: false, isSuperAdmin: true });
  assert.equal(admin.primary.filter(item => isNavigationActive(item, '/dashboard/admin', 'churches')).length, 1);
  const family = getNavigation({ role: 'berger', hasFamily: true });
  assert.equal(family.primary.filter(item => isNavigationActive(item, '/dashboard/invites', null)).length, 1);
  assert.equal(isNavigationActive(family.primary[0], '/dashboard/activities', null), false);
});

test('person summary preserves explicit absences, services and unknown statuses', () => {
  let attendance = buildAttendanceUpdate({}, 'culte', '2026-09-13', 'present', '', 'culte_2');
  attendance = buildAttendanceUpdate(attendance, 'culte', '2026-09-06', 'justified', 'Maladie');
  attendance = buildAttendanceUpdate(attendance, 'cdm', '2026-09-10', 'unjustified');
  attendance.culte['2026-08-30'] = false;
  const summary = summarizePerson({ attendance }, 'member');
  assert.equal(summary.events[0].status, 'Présent · Culte 2');
  assert.equal(summary.events[1].status, 'Absence non justifiée');
  assert.equal(summary.events[2].reason, 'Maladie');
  assert.equal(summary.events[3].status, 'Non pointé');
  assert.equal(summary.eventCount, 4);
});

test('contact opt-out overrides suggested outreach and no history is invented', () => {
  const summary = summarizePerson({ souhaiteEtreContacte: false, phone: '+32 470 000 000' }, 'guest');
  assert.equal(summary.contactAllowed, false);
  assert.match(summary.nextAction, /ne souhaite pas/);
  assert.equal(summary.eventCount, 0);
  assert.equal(summary.steps.some(step => step.done), false);
});
