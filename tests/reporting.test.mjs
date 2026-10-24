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

test('preserves backward compatibility and calculates presential-only participation rate', () => {
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
  // Physical attendees = 4 + 3 = 7 (Rate = 70%), online (1) excluded from participation rate
  assert.equal(metrics.totalParticipation, 7);
  assert.equal(metrics.tauxParticipationGlobale, 70);
  assert.equal(metrics.totalParticipationAvecLigne, 8); // Preserved informatively
  assert.equal(metrics.pctTotalCulteEnLigne, 10);
  assert.equal(metrics.totalAbsences, 3);
  assert.equal(metrics.disciplesPresents, 4); // 2 + 2 = 4
});

test('excludes online attendees from disciples participation rate while keeping online metric', () => {
  const data = {
    nom_famille: 'Famille Disciples Test',
    nom_berger: 'Berger Test',
    date_rapport: '2026-10-18',
    nombre_total_membres: 10,
    repartition_hommes: 5,
    repartition_femmes: 5,
    culte_1: 6,
    culte_2: 0,
    culte_1_et_2: 0,
    culte_en_ligne: 2,
    absences_justifiees: 0,
    absences_non_justifiees: 4,
    star_en_service: 0,
    nombre_total_star: 0,
    reunion_hebdomadaire: 0,
    nouveaux_membres: 0,
    nombre_disciples: 4,
    disciples_culte_1: 2,
    disciples_culte_2: 0,
    disciples_culte_1_et_2: 0,
    disciples_culte_en_ligne: 1,
    taux_participation_disciples: 0,
    points_cles: [],
    action_1: '',
    action_2: '',
    action_3: '',
    verset_texte: '',
    verset_ref: '',
  };

  const metrics = computeReportingMetrics(data);
  // Global: 6 physical on 10 members = 60%, NOT 80%
  assert.equal(metrics.totalParticipation, 6);
  assert.equal(metrics.tauxParticipationGlobale, 60);
  assert.equal(metrics.totalParticipationAvecLigne, 8);
  assert.equal(metrics.pctTotalCulteEnLigne, 20);

  // Disciples: 2 physical on 4 disciples = 50%, NOT 75%
  assert.equal(metrics.disciplesPresents, 2);
  assert.equal(metrics.tauxParticipationDisciples, 50);
  assert.equal(metrics.disciplesCulteEnLigne, 1);
  assert.equal(metrics.pctDisciplesCulteEnLigne, 25);
});
