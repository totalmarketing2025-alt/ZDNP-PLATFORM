import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

// Cross-check the Worker WebCrypto implementation against the Termux Python
// hashlib.pbkdf2_hmac convention. No real credentials or production hashes.
async function workerPbkdf(password, salt) {
  const bytes = new TextEncoder();
  const key = await webcrypto.subtle.importKey('raw', bytes.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await webcrypto.subtle.deriveBits({
    name: 'PBKDF2', salt: bytes.encode(salt), iterations: 310000, hash: 'SHA-256'
  }, key, 256);
  return Buffer.from(derived).toString('hex');
}
test('Worker PBKDF2 matches independent Node/Python-compatible implementation', async () => {
  const password = 'synthetic-test-password-123!';
  const salt = '0123456789abcdef0123456789abcdef';
  const expected = pbkdf2Sync(Buffer.from(password), Buffer.from(salt), 310000, 32, 'sha256');
  const actual = Buffer.from(await workerPbkdf(password, salt), 'hex');
  assert.ok(timingSafeEqual(actual, expected));
});
test('different password does not match', async () => {
  const salt = '0123456789abcdef0123456789abcdef';
  assert.notEqual(await workerPbkdf('synthetic-test-password-123!', salt),
                  await workerPbkdf('synthetic-test-password-123?', salt));
});
