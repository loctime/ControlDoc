import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenantIdFromHost, isAllowedTenantHost } from '../utils/tenantUtils.js';

test('resolve canonical subdomain tenant', () => {
  assert.equal(resolveTenantIdFromHost('acme.controldoc.app'), 'acme');
});

test('resolve root domain to default', () => {
  assert.equal(resolveTenantIdFromHost('controldoc.app'), 'default');
});

test('reject arbitrary vercel hostname', () => {
  assert.equal(resolveTenantIdFromHost('my-preview.vercel.app'), null);
});

test('reject malformed nested hostname inside canonical root', () => {
  assert.equal(resolveTenantIdFromHost('a.b.controldoc.app'), null);
});

test('allow canonical host', () => {
  assert.equal(isAllowedTenantHost('acme.controldoc.app'), true);
});

test('disallow unknown host', () => {
  assert.equal(isAllowedTenantHost('evil.example.com'), false);
});
