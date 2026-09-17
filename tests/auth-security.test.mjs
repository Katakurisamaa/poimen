import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const churchId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const contextId = '33333333-3333-4333-8333-333333333333';

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const fixtureModule = { exports: {} };
  vm.runInNewContext(code, {
    module: fixtureModule, exports: fixtureModule.exports, console,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } },
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import ${name}`);
    },
  }, { filename: file });
  return fixtureModule.exports;
}

function harness({ user = null, sessionResult = () => ({ data: null }), serviceResult = () => ({ data: null }), users = [] } = {}) {
  const calls = [];
  function client(kind, resolve) {
    return {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
        admin: {
          listUsers: async () => ({ data: { users }, error: null }),
          createUser: async () => { throw new Error('Unexpected account creation'); },
          updateUserById: async () => { throw new Error('Password reset forbidden'); },
        },
      },
      from(table) {
        const query = { kind, table, op: 'select', filters: [] };
        const chain = {};
        for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'ilike']) {
          chain[method] = (...args) => {
            if (['insert', 'update', 'delete'].includes(method)) { query.op = method; query.payload = args[0]; }
            else if (method !== 'select') query.filters.push([method, ...args]);
            return chain;
          };
        }
        const finish = () => { calls.push(query); return resolve(query); };
        chain.single = chain.maybeSingle = async () => finish();
        chain.then = (yes, no) => Promise.resolve(finish()).then(yes, no);
        return chain;
      },
    };
  }
  const session = client('session', sessionResult);
  const service = client('service', serviceResult);
  let privilegedClients = 0;
  const actions = load('app/actions/auth.ts', {
    '@supabase/supabase-js': { createClient: () => { privilegedClients++; return service; } },
    '@/lib/supabase-server': { createClient: async () => session },
    '@/lib/auth-contexts': load('lib/auth-contexts.ts'),
    '@/lib/security-validation': load('lib/security-validation.ts'),
  });
  return { actions, calls, privilegedClients: () => privilegedClients };
}

test('anonymous calls cannot reach privileged data or create an account', async () => {
  const h = harness();
  for (const result of [
    await h.actions.getIntegrationDropdownList(churchId),
    await h.actions.adminSignUp('person@example.com', 'shared-code'),
    await h.actions.createFamilyUserContext({ userId, familyId: churchId }),
  ]) assert.equal(result.success, false);
  assert.equal(h.privilegedClients(), 0);
});

test('getFamilyLeadersList fetches family leaders for login dropdown', async () => {
  const h = harness({
    serviceResult: q => ({
      data: q.table === 'bergeries'
        ? { id: churchId, name: 'Famille Test', creator_email: 'leader@example.com', creator_first_name: 'Test', creator_last_name: 'Leader', creator_role: 'Berger', archived: false }
        : q.table === 'members'
        ? [{ id: userId, email: 'second@example.com', civility: 'M.', first_name: 'Second', last_name: 'Leader', status: 'Second du berger' }]
        : null
    })
  });
  const res = await h.actions.getFamilyLeadersList(churchId);
  assert.equal(res.success, true);
  assert.equal(res.leaders.length, 2);
  assert.equal(res.leaders[0].status, 'Berger');
  assert.equal(res.leaders[1].status, 'Second du berger');
});

test('a revoked context overrides a stale manager profile', async () => {
  const h = harness({ user: { id: userId, email: 'manager@example.com' }, sessionResult: q => ({
    data: q.table === 'user_contexts' ? [{ role: 'integration_responsable', active: false }]
      : { role: 'integration_responsable', church_id: churchId, active: true },
  }) });
  const result = await h.actions.deactivateIntegrationTeamMember({ churchId, userId });
  assert.equal(result.success, false);
  assert.equal(h.privilegedClients(), 0);
});

test('adding an existing account preserves its password', async () => {
  const h = harness({
    user: { id: userId, email: 'minkojunior400@gmail.com' },
    users: [{ id: userId, email: 'member@example.com' }],
    serviceResult: q => ({ data: q.table === 'profiles' ? { active: true } : null, error: null }),
  });
  const result = await h.actions.createIntegrationTeamMember({ churchId, firstName: 'Test', lastName: 'Member', email: 'member@example.com', accessCode: 'ignored', role: 'integration_conseiller' });
  assert.equal(result.success, true);
  assert.equal(result.requiresPrimaryPassword, true);
  assert.ok(h.calls.some(q => q.table === 'user_contexts' && q.op === 'insert'));
});

test('editing a foreign context is rejected before mutation', async () => {
  const h = harness({ user: { id: userId, email: 'minkojunior400@gmail.com' } });
  const result = await h.actions.updateIntegrationTeamMember({ churchId, userId, contextId, firstName: 'Test', lastName: 'Member', email: 'member@example.com', role: 'integration_second' });
  assert.equal(result.success, false);
  assert.ok(h.calls.every(q => q.op === 'select'));
  const lookup = h.calls.find(q => q.table === 'user_contexts');
  for (const [field, value] of [['id', contextId], ['user_id', userId], ['church_id', churchId], ['context_type', 'integration']]) {
    assert.ok(lookup.filters.some(f => f[0] === 'eq' && f[1] === field && f[2] === value));
  }
});

test('family context cannot be granted to another identity', async () => {
  const h = harness({ user: { id: userId, email: 'person@example.com' } });
  const result = await h.actions.createFamilyUserContext({ userId: contextId, familyId: churchId, role: 'super_admin' });
  assert.equal(result.success, false);
  assert.equal(h.privilegedClients(), 0);
});

test('leader status is an allowlist, not a substring match', () => {
  const { isFamilyLeader, isUuid } = load('lib/security-validation.ts');
  assert.equal(isFamilyLeader('second du berger'), true);
  assert.equal(isFamilyLeader('not-a-berger'), false);
  assert.equal(isFamilyLeader('super_admin'), false);
  assert.equal(isUuid('../other-tenant'), false);
});

test('central administrator identity cannot be provisioned through team management', async () => {
  const h = harness({ user: { id: userId, email: 'manager@example.com' }, sessionResult: () => ({ data: [{ role: 'integration_responsable', active: true }] }) });
  const result = await h.actions.createIntegrationTeamMember({ churchId, firstName: 'Test', lastName: 'Admin', email: 'minkojunior400@gmail.com', accessCode: 'not-a-real-password', role: 'integration_second' });
  assert.equal(result.success, false);
  assert.ok(h.calls.every(q => q.op === 'select'));
});

test('missing authorization table fails closed', async () => {
  const h = harness({ user: { id: userId, email: 'manager@example.com' }, sessionResult: () => ({ data: null, error: { message: 'table missing' } }) });
  assert.equal((await h.actions.listIntegrationTeam(churchId)).success, false);
  assert.equal(h.privilegedClients(), 0);
});
