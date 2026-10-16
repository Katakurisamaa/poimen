import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(relativePath) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date });
  return module.exports;
}
const { inviteCopy, localizedOptions, eventValues, ageValues, civilityValues } = load('../app/public-invite/translations.ts');
const { emptyInvite, invitePayload, nextInvite, validateInvite } = load('../app/public-invite/form-data.ts');
const valid = () => ({ ...emptyInvite(), firstName: 'Alex', lastName: 'Example', phone: '+32 470 00 00 00', aps: false, localChurch: false, baptemeEau: false, interetFormation: false, interetCDM: false });

test('all three form languages preserve French values in the integration payload', () => {
  for (const locale of ['fr', 'en', 'nl']) {
    const copy = inviteCopy[locale];
    for (const [field, values, labels, stored] of [
      ['event', eventValues, copy.events, 'event'], ['age', ageValues, copy.ages, 'age'], ['civility', civilityValues, copy.civilities, 'civility'],
    ]) {
      const options = localizedOptions(values, labels);
      assert.equal(options.length, values.length);
      for (let i = 0; i < options.length; i++) {
        assert.ok(options[i].label);
        assert.equal(invitePayload({ ...valid(), [field]: options[i].value }, 'church-id')[stored], values[i]);
      }
    }
  }
});

test('saving preserves free text and names without translating or mixing display labels into data', () => {
  const payload = invitePayload({ ...valid(), pays: 'Pays-Bas', commentaire: ' Please pray for my family. ', autreEglise: 'My church', localChurch: true }, 'church-id');
  assert.equal(payload.commentaire, 'Please pray for my family.');
  assert.equal(payload.autre_eglise, 'My church');
  assert.equal(payload.pays, 'Pays-Bas');
  assert.equal(payload.church_id, 'church-id');
  assert.equal(payload.responsible, 'Non assigné');
  assert.equal(payload.aps, false);
});

test('both saving actions can share validation: no missing church, email typo or unanswered question', () => {
  assert.equal(validateInvite(valid(), 'church-id'), null);
  assert.equal(validateInvite(valid(), '').field, 'church');
  assert.equal(validateInvite({ ...valid(), firstName: '   ' }, 'church-id').field, 'firstName');
  assert.equal(validateInvite({ ...valid(), email: 'broken@' }, 'church-id').message, 'emailError');
  for (const field of ['aps', 'localChurch', 'baptemeEau', 'interetFormation', 'interetCDM']) {
    assert.equal(validateInvite({ ...valid(), [field]: null }, 'church-id').field, field);
  }
  assert.equal(validateInvite({ ...valid(), localChurch: true }, 'church-id').field, 'autreEglise');
});

test('hidden conditional answers are excluded, including obsolete baptism interest', () => {
  const payload = invitePayload({ ...valid(), baptemeEau: true, interetBapteme: true, autreEglise: 'Old answer', parQui: 'Old inviter' }, 'church-id');
  assert.equal(payload.interet_bapteme, false);
  assert.equal(payload.autre_eglise, null);
  assert.equal(payload.par_qui, null);
});

test('adding a relative keeps shared details and resets personal answers', () => {
  const previous = { ...valid(), address: 'Example street', email: 'alex@example.com', commentaire: 'Private request', aEteInvite: true, parQui: 'Sam', pays: 'France' };
  const family = nextInvite(previous, true);
  assert.equal(family.lastName, previous.lastName);
  assert.equal(family.pays, 'France');
  assert.equal(family.address, previous.address);
  assert.equal(family.parQui, 'Sam');
  assert.equal(family.firstName, '');
  assert.equal(family.email, '');
  assert.equal(family.commentaire, '');
  assert.equal(family.aps, null);
  const blank = nextInvite(previous, false);
  assert.equal(blank.lastName, '');
  assert.equal(blank.address, '');
  assert.equal(blank.arrivalDate, previous.arrivalDate);
  assert.equal(blank.event, previous.event);
});

test('each language includes all messages and all choice labels', () => {
  for (const copy of Object.values(inviteCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(inviteCopy.fr).sort());
    for (const value of Object.values(copy)) assert.ok(Array.isArray(value) ? value.every(Boolean) : value.trim());
  }
});
