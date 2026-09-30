import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/cr-call-center.ts', import.meta.url), 'utf8');
const fixture = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: fixture, exports: fixture.exports });
const { buildCrReport, crReportText } = fixture.exports;
test('report preserves the three sections and 18 automated detail rows', () => {
  const report = buildCrReport([]);
  assert.equal(report.length, 3);
  assert.equal(report.flatMap(g => g.rows).length, 18);
  assert.equal(report[0].rows.length, 3);
  assert.equal(report[1].rows.length, 3);
  assert.equal(report[2].rows.length, 12);
});
test('notes alone do not invent calls and missing numbers are counted once', () => {
  const report = buildCrReport([{id:'1',commentaireSuivi:'Note pastorale'}, {id:'2',fauxNumero:true}, {id:'3',appelAbouti:true,phone:'123'}]);
  assert.equal(report[0].value, 3);
  assert.equal(report[1].value, 2);
  assert.equal(report[1].rows[0].value, 2); // id 1 (sans numéro) + id 2 (fauxNumero)
  assert.equal(report[1].rows[2].value, 1); // id 1 (non entamé)
  assert.equal(report[2].value, 1);
});
test('PCNC and pillars count each person once; discipleship family does not imply cell membership', () => {
  const rows = buildCrReport([{id:'1',p101:true,p201:true,piliers1:true,termine12Piliers:true,dansFamilleDisciple:true}])[2].rows;
  assert.equal(rows.find(r=>r.label==='Inscrit au PCNC').value, 1);
  assert.equal(rows.find(r=>r.label==='Inscrit au groupe des 12 piliers').value, 1);
  assert.equal(rows.find(r=>r.label==='Cellule de maison ok').value, 0);
});
test('text includes every requested metric and full comment, without individual data', () => {
  const guests=[{id:'1',firstName:'Nom privé',phone:'0123456',appelAbouti:true}];
  const comment='Observation longue. '.repeat(500)+'FIN';
  const text=crReportText(guests,'TEST','Du 28/06/2026',comment);
  for(const group of buildCrReport(guests)) { assert.ok(text.includes(`${group.title} : ${group.value}`)); for(const row of group.rows) assert.ok(text.includes(`${row.label} : ${row.value}`)); }
  assert.ok(text.includes(comment)); assert.ok(!text.includes('Nom privé')); assert.ok(!text.includes('0123456'));
});

