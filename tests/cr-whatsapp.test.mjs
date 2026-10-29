import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/cr-whatsapp.ts', import.meta.url), 'utf8');
const fixture = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module: fixture, exports: fixture.exports }
);

const { formatCrDate, cleanCommentaire, guestToSoulCrItem, formatSoulCrBlock, formatFullCrMessage, buildWhatsAppShareUrl } = fixture.exports;

test('formatCrDate converts ISO date to DD/MM/YYYY', () => {
  assert.equal(formatCrDate('2026-07-07'), '07/07/2026');
  assert.equal(formatCrDate('2026-07-07T10:30:00Z'), '07/07/2026');
});

test('cleanCommentaire removes technical tags', () => {
  const raw = '[STATUT:sans_suite] [MOTIF_RETRAIT:faux_numero] [FAUX_NUMERO] Numéro erroné';
  assert.equal(cleanCommentaire(raw), 'Numéro erroné');
});

test('formatFullCrMessage generates exactly the expected WhatsApp structure', () => {
  const item = {
    id: '1',
    name: 'Bongoy Bowane Bijoux',
    arrivalDate: '2026-07-07',
    appelAbouti: true,
    revientEglise: true,
    groupeWhatsapp: true,
    pcnc: true,
    celluleMaison: 'je regarderai celle proche de chez elle',
    crEnLigne: true,
    commentaire: 'bel échange elle s’intègre bien a rejoint aussi le groupe des femmes'
  };

  const message = formatFullCrMessage([item]);

  assert.ok(message.includes('*CR CALL CENTER DES INVITÉS DU _07/07/2026_*'));
  assert.ok(message.includes('*Bongoy Bowane Bijoux*'));
  assert.ok(message.includes('*Appel Abouti* : ✅'));
  assert.ok(message.includes('*Revient à l’église* : ✅'));
  assert.ok(message.includes('*Groupe WhatsApp* :  ✅'));
  assert.ok(message.includes('*PCNC* :✅'));
  assert.ok(message.includes('*Cellule de maison*: je regarderai celle proche de chez elle'));
  assert.ok(message.includes('*CR en ligne* : ✅'));
  assert.ok(message.includes('*Commentaire* : bel échange elle s’intègre bien a rejoint aussi le groupe des femmes'));
  assert.ok(message.includes('Blessings 💎'));
});

test('buildWhatsAppShareUrl generates valid wa.me link', () => {
  const url = buildWhatsAppShareUrl('Hello *World*');
  assert.ok(url.startsWith('https://api.whatsapp.com/send?text=Hello%20*World*'));
});

test('group version excludes notes while team version keeps them', () => {
  const item = guestToSoulCrItem({ id: '1', firstName: 'Sarah', commentaireSuivi: 'À rappeler jeudi' });
  const group = formatFullCrMessage([item], '2026-10-25', 'group');
  const team = formatFullCrMessage([item], '2026-10-25', 'team');
  assert.ok(!group.includes('À rappeler jeudi'));
  assert.ok(!group.includes('*Commentaire*'));
  assert.ok(team.includes('*Commentaire* : À rappeler jeudi'));
  assert.equal(team.replace('\n\n*Commentaire* : À rappeler jeudi', ''), group);
  assert.equal(new URL(buildWhatsAppShareUrl(team)).searchParams.get('text'), team);
});

test('explicit unknown statuses remain unknown in the message', () => {
  const item = guestToSoulCrItem({ id: '1', prevuRevenir: true });
  item.revientEglise = null;
  item.crEnLigne = null;
  const block = formatSoulCrBlock(item);
  assert.ok(block.includes('*Revient à l’église* : À préciser'));
  assert.ok(block.includes('*CR en ligne* : À préciser'));
});

test('interest in training alone is not participation in PCNC', () => {
  assert.equal(guestToSoulCrItem({ id: '1', interetFormation: true }).pcnc, null);
  assert.equal(guestToSoulCrItem({ id: '1', interetFormation: true, p101: false }).pcnc, false);
  assert.equal(guestToSoulCrItem({ id: '1', p101: true }).pcnc, true);
});

test('prefills 12 piliers and aps from guest record', () => {
  const item1 = guestToSoulCrItem({ id: '1', termine12Piliers: true, aps: false });
  assert.equal(item1.douzePiliers, true);
  assert.equal(item1.aps, false);

  const block = formatSoulCrBlock(item1);
  assert.ok(block.includes('*12 piliers* : ✅'));
  assert.ok(block.includes('*APS* : ❌'));

  const item2 = guestToSoulCrItem({ id: '2', piliers1: true, is_aps: true });
  assert.equal(item2.douzePiliers, true);
  assert.equal(item2.aps, true);
});

test('allows excluding specific fields from the WhatsApp message', () => {
  const item = {
    id: '1',
    name: 'Jean Test',
    appelAbouti: true,
    revientEglise: true,
    groupeWhatsapp: true,
    pcnc: true,
    douzePiliers: true,
    aps: true,
    celluleMaison: 'Cellule Nord',
    crEnLigne: true,
    commentaire: ''
  };

  const fullBlock = formatSoulCrBlock(item);
  assert.ok(fullBlock.includes('*12 piliers* : ✅'));
  assert.ok(fullBlock.includes('*APS* : ✅'));
  assert.ok(fullBlock.includes('*Cellule de maison*: Cellule Nord'));

  const excludedBlock = formatSoulCrBlock(item, 'team', ['douzePiliers', 'aps', 'celluleMaison']);
  assert.ok(!excludedBlock.includes('*12 piliers*'));
  assert.ok(!excludedBlock.includes('*APS*'));
  assert.ok(!excludedBlock.includes('*Cellule de maison*'));
  assert.ok(excludedBlock.includes('*Appel Abouti* : ✅'));
  assert.ok(excludedBlock.includes('*Revient à l’église* : ✅'));
});

test('supports independent per-person field exclusions in formatFullCrMessage', () => {
  const person1 = {
    id: '1',
    name: 'Alice',
    arrivalDate: '2026-10-25',
    appelAbouti: true,
    revientEglise: true,
    groupeWhatsapp: true,
    pcnc: true,
    douzePiliers: true,
    aps: true,
    celluleMaison: 'Cellule A',
    crEnLigne: true,
    commentaire: '',
    excludedFields: ['douzePiliers', 'aps']
  };

  const person2 = {
    id: '2',
    name: 'Bob',
    arrivalDate: '2026-10-25',
    appelAbouti: true,
    revientEglise: true,
    groupeWhatsapp: true,
    pcnc: true,
    douzePiliers: true,
    aps: true,
    celluleMaison: 'Cellule B',
    crEnLigne: true,
    commentaire: '',
    excludedFields: []
  };

  const message = formatFullCrMessage([person1, person2], '2026-10-25', 'group');

  // Alice has 12 piliers and APS excluded
  const aliceSection = message.split('*Bob*')[0];
  assert.ok(aliceSection.includes('*Alice*'));
  assert.ok(!aliceSection.includes('*12 piliers*'));
  assert.ok(!aliceSection.includes('*APS*'));
  assert.ok(aliceSection.includes('*Appel Abouti* : ✅'));

  // Bob has all fields included
  const bobSection = message.split('*Bob*')[1];
  assert.ok(bobSection.includes('*12 piliers* : ✅'));
  assert.ok(bobSection.includes('*APS* : ✅'));
  assert.ok(bobSection.includes('*Appel Abouti* : ✅'));
});

