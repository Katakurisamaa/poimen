import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'types/reporting.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const fixtureModule = { exports: {} };
vm.runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports });
const { computeReportingMetrics, getKeyPointsSummary } = fixtureModule.exports;

test('calculates accurate unique attendance and absences when members attend both cultes', () => {
  // Family with 10 total members:
  // 5 attended only Culte 1
  // 2 attended only Culte 2
  // 1 attended BOTH Culte 1 and Culte 2
  // (So Culte 1 total = 6, Culte 2 total = 3, Culte 1 & 2 = 1)
  // 2 members were absent (1 justified, 1 unjustified)
  const reportData = {
    nom_famille: 'Famille Éphésiens',
    nom_berger: 'Berger Test',
    date_rapport: '2026-10-18',
    nombre_total_membres: 10,
    repartition_hommes: 5,
    repartition_femmes: 5,
    culte_1: 6,
    culte_2: 3,
    culte_1_et_2: 1,
    culte_en_ligne: 0,
    absences_justifiees: 1,
    absences_non_justifiees: 0, // Auto-computed
    star_en_service: 2,
    nombre_total_star: 3,
    reunion_hebdomadaire: 4,
    nouveaux_membres: 0,
    nombre_disciples: 4,
    disciples_culte_1: 3,
    disciples_culte_2: 2,
    disciples_culte_1_et_2: 1,
    disciples_culte_en_ligne: 0,
    taux_participation_disciples: 0,
    points_cles: [],
    action_1: '',
    action_2: '',
    action_3: '',
    verset_texte: '',
    verset_ref: '',
  };

  const metrics = computeReportingMetrics(reportData);

  // Total unique participants should be 8 (6 + 3 - 1 = 8), NOT 9
  assert.equal(metrics.totalParticipation, 8);
  assert.equal(metrics.tauxParticipationGlobale, 80);

  // Total absences should be 2 (10 - 8 = 2), NOT 1
  assert.equal(metrics.totalAbsences, 2);
  assert.equal(metrics.pctTotalAbsenceDimanche, 20);

  // Absences non justifiées = 2 total - 1 justifiée = 1
  assert.equal(metrics.pctTotalAbsencesNonJustifiees, 10);
  assert.equal(metrics.pctTotalAbsencesJustifiees, 10);

  // Disciples: 3 at C1, 2 at C2, 1 at both => 3 + 2 - 1 = 4 unique disciples present (100%)
  assert.equal(metrics.disciplesPresents, 4);
  assert.equal(metrics.tauxParticipationDisciples, 100);

  // Key points should mention the dual-service attendees
  const points = getKeyPointsSummary(reportData, metrics);
  assert.ok(points.some(p => p.includes('aux deux cultes')));
});

test('preserves backward compatibility when culte_1_et_2 is 0 or undefined', () => {
  const legacyData = {
    nom_famille: 'Famille Galates',
    nom_berger: 'Berger Test',
    date_rapport: '2026-10-18',
    nombre_total_membres: 10,
    repartition_hommes: 5,
    repartition_femmes: 5,
    culte_1: 4,
    culte_2: 3,
    culte_en_ligne: 1,
    absences_justifiees: 1,
    absences_non_justifiees: 1,
    star_en_service: 0,
    nombre_total_star: 0,
    reunion_hebdomadaire: 0,
    nouveaux_membres: 0,
    nombre_disciples: 5,
    disciples_culte_1: 2,
    disciples_culte_2: 2,
    disciples_culte_en_ligne: 0,
    taux_participation_disciples: 0,
    points_cles: [],
    action_1: '',
    action_2: '',
    action_3: '',
    verset_texte: '',
    verset_ref: '',
  };

  const metrics = computeReportingMetrics(legacyData);
  assert.equal(metrics.totalParticipation, 8); // 4 + 3 + 1 = 8
  assert.equal(metrics.totalAbsences, 2);
  assert.equal(metrics.disciplesPresents, 4); // 2 + 2 = 4
});
