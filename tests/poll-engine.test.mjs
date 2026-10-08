import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/poll-engine.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports, structuredClone, Date });
const { transition, snapshot, validateDraft, exportPollsCsv } = module.exports;
const host = { voterId: 'host', canManage: true };
const guest = { voterId: 'guest', canManage: false };
const draft = { type: 'quiz', question: 'Quel livre ?', options: [{ id: 'a', text: 'Matthieu' }, { id: 'b', text: 'Marc' }], correctOptionId: 'a', explanation: 'Référence confidentielle', durationSeconds: 30 };
function saved() { return transition({ polls: [] }, { action: 'save', draft }, host, 1000, 'q1'); }
function launched() { return transition(saved(), { action: 'launch', pollId: 'q1' }, host, 2000, 'unused'); }
const vote = { action: 'vote', pollId: 'q1', optionId: 'a', name: 'Invité' };

test('participant cannot see drafts, answers, explanations, ballots or hidden results', () => {
  assert.equal(snapshot(saved(), false, 'guest', 2000).polls.length, 0);
  const state = transition(launched(), vote, guest, 3000, 'unused');
  const view = snapshot(state, false, 'guest', 4000);
  assert.equal(view.polls[0].totalVotes, 1);
  assert.equal(view.polls[0].myVote.optionId, 'a');
  const json = JSON.stringify(view);
  for (const hidden of ['correctOptionId', 'Référence confidentielle', 'ballots', 'voterId', 'counts']) assert.equal(json.includes(hidden), false, hidden);
  assert.equal(snapshot(state, true, 'host', 4000).polls[0].correctOptionId, 'a');
});

test('refresh and duplicate delivery keep exactly one immutable vote per identity', () => {
  const once = transition(launched(), vote, guest, 3000, 'unused');
  const retried = transition(once, { ...vote, optionId: 'b' }, guest, 4000, 'unused');
  assert.equal(retried.polls[0].ballots.length, 1);
  assert.equal(retried.polls[0].ballots[0].optionId, 'a');
  const afterClose = transition(retried, { action: 'close', pollId: 'q1' }, host, 5000, 'unused');
  assert.equal(transition(afterClose, vote, guest, 6000, 'unused').polls[0].ballots.length, 1);
});

test('server deadline rejects late ballots, including open answers', () => {
  assert.throws(() => transition(launched(), vote, guest, 32000, 'unused'), /clôturés/);
  assert.equal(snapshot(launched(), false, 'guest', 32000).polls[0].status, 'closed');
  let state = transition({ polls: [] }, { action: 'save', draft: { ...draft, type: 'open' } }, host, 1000, 'open');
  state = transition(state, { action: 'launch', pollId: 'open' }, host, 2000, 'unused');
  assert.throws(() => transition(state, { action: 'vote', pollId: 'open', text: 'Bonjour', name: 'Test' }, guest, 32001, 'unused'), /clôturés/);
});

test('publishing results and revealing a solution are separate server decisions', () => {
  let state = transition(launched(), vote, guest, 3000, 'unused');
  assert.throws(() => transition(state, { action: 'answer', pollId: 'q1' }, host, 4000, 'unused'), /Clôturez/);
  state = transition(state, { action: 'results', pollId: 'q1' }, host, 5000, 'unused');
  let view = snapshot(state, false, 'guest', 6000);
  assert.equal(view.polls[0].counts.a, 1);
  assert.equal(view.polls[0].correctOptionId, undefined);
  state = transition(state, { action: 'close', pollId: 'q1' }, host, 7000, 'unused');
  state = transition(state, { action: 'answer', pollId: 'q1' }, host, 8000, 'unused');
  view = snapshot(state, false, 'guest', 9000);
  assert.equal(view.polls[0].correctOptionId, 'a');
  assert.equal(view.score.correct, 1);
  assert.equal(view.score.answered, 1);
});

test('launching the next question preserves history, votes and personal quiz score', () => {
  let state = transition(launched(), vote, guest, 3000, 'unused');
  state = transition(state, { action: 'duplicate', pollId: 'q1' }, host, 4000, 'q2');
  assert.equal(state.polls[1].ballots.length, 0);
  state = transition(state, { action: 'launch', pollId: 'q2' }, host, 5000, 'unused');
  assert.equal(state.polls[0].status, 'closed');
  assert.equal(state.polls[0].ballots.length, 1);
  assert.equal(snapshot(state, false, 'guest', 6000).polls[0].id, 'q2');
  assert.equal(snapshot(state, true, 'host', 6000).polls.length, 2);
});

test('untrusted commands cannot control a room or invent options', () => {
  for (const action of ['launch', 'close', 'reopen', 'results', 'answer', 'duplicate', 'remove']) assert.throws(() => transition(launched(), { action, pollId: 'q1' }, guest, 3000, 'unused'), /animateur/);
  assert.throws(() => transition(launched(), { ...vote, optionId: 'not-an-option' }, guest, 3000, 'unused'), /proposée/);
  assert.throws(() => transition(launched(), { ...vote, pollId: 'old-poll' }, guest, 3000, 'unused'), /existe/);
  assert.throws(() => transition(launched(), { action: 'remove', pollId: 'q1' }, host, 3000, 'unused'), /brouillons/);
});

test('stable option IDs preserve the correct answer when another option is removed', () => {
  assert.equal(validateDraft({ ...draft, options: [{ id: 'c', text: 'Luc' }, draft.options[0]], correctOptionId: 'a' }).correctOptionId, 'a');
  assert.throws(() => validateDraft({ ...draft, correctOptionId: 'removed' }), /bonne réponse/);
  assert.throws(() => validateDraft({ ...draft, options: [draft.options[0], { id: 'b', text: ' Matthieu ' }] }), /différentes/);
  assert.throws(() => validateDraft({ ...draft, durationSeconds: -1 }), /Durée/);
});

test('open responses stay hidden until publication and CSV escapes formulas and quotes', () => {
  let state = transition({ polls: [] }, { action: 'save', draft: { ...draft, type: 'open', question: '=SUM(A1)', durationSeconds: 0 } }, host, 1000, 'q1');
  state = transition(state, { action: 'launch', pollId: 'q1' }, host, 2000, 'unused');
  state = transition(state, { action: 'vote', pollId: 'q1', text: 'Un "texte";\nmultiligne', name: '@test' }, guest, 3000, 'unused');
  assert.equal(snapshot(state, false, 'other', 4000).polls[0].answers, undefined);
  const csv = exportPollsCsv(snapshot(state, true, 'host', 4000));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=SUM(A1)"));
  assert.ok(csv.includes("'@test"));
  assert.ok(csv.includes('""texte""'));
});
