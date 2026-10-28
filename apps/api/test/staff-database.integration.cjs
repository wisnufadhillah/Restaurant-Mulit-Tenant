const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createDatabaseClient } = require('../dist/database/client');
const { hashPassword, createSessionToken, hashSessionToken } = require('../dist/auth/crypto');

const rollback = new Error('Rollback synthetic auth probe');

test('staff session persists hashed token, revokes and rejects cross-tenant foreign key', async () => {
  const db = createDatabaseClient();
  const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
  try {
    await assert.rejects(db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { slug: `auth-${randomUUID()}`, name: 'Synthetic auth tenant' } });
      const other = await tx.tenant.create({ data: { slug: `auth-${randomUUID()}`, name: 'Synthetic other tenant' } });
      const staff = await tx.staff.create({ data: { tenantId: tenant.id, username: 'synthetic.staff', passwordHash, role: 'staff' } });
      const token = createSessionToken();
      const session = await tx.staffSession.create({ data: { tenantId: tenant.id, staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60000) } });
      const stored = await tx.staffSession.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { staff: true } });
      assert.equal(stored.staff.tenantId, tenant.id);
      assert.notEqual(stored.tokenHash, token);
      await tx.staffSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      assert.ok((await tx.staffSession.findUnique({ where: { id: session.id } })).revokedAt);
      await tx.$executeRawUnsafe('SAVEPOINT foreign_key_probe');
      await assert.rejects(tx.staffSession.create({ data: { tenantId: other.id, staffId: staff.id, tokenHash: hashSessionToken(createSessionToken()), expiresAt: new Date(Date.now() + 60000) } }), error => error.code === 'P2003');
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT foreign_key_probe');
      throw rollback;
    }, { timeout: 15000 }), error => error === rollback);
  } finally { await db.$disconnect(); }
});
