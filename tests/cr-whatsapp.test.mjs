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
