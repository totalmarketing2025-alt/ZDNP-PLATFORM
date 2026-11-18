import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('./src/worker.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('./migrations/0002_central_ngad.sql',import.meta.url),'utf8');
test('central privilege is opt-in, not automatic',()=>{assert.match(migration,/global_admin INTEGER NOT NULL DEFAULT 0/);assert.match(migration,/NEW.username<>'NGAD'/)});
test('central admin requires both privilege and NGAD identity',()=>assert.match(worker,/actor.global_admin===1&&actor.username==='NGAD'/));
test('staff case access remains scoped to institution and nonconfidential cases',()=>{assert.match(worker,/WHERE institution_id=\? AND confidential=0/);assert.match(worker,/assigned_to IS NULL OR assigned_to=\?/);});
test('central admin cannot create additional NGAD or modify another central account',()=>{assert.match(worker,/b.username.toUpperCase\(\)==='NGAD'/);assert.match(worker,/target.global_admin===1/);});
test('no deployment enabled by default',()=>{const config=readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');assert.match(config,/workers_dev = false/)});

test('local account operations bind actor institution, not uninitialized target',()=>assert.match(worker,/SELECT \* FROM users WHERE id=\? AND institution_id=\?'\)\.bind\(id,actor\.institution_id\)/));
test('cross-institution disable uses target institution',()=>assert.match(worker,/UPDATE users SET enabled=0 WHERE id=\? AND institution_id=\?'\)\.bind\(id,target\.institution_id\)/));
// The current public portal is protected by application credentials, not by
// Cloudflare Access. The temporary recovery path must never become open login.
test('temporary test path requires secret, deadline and NGAD central identity',()=>{
 assert.match(worker,/if\(!ngadTestWindow\(env\)\)return json/);
 assert.match(worker,/secureCompare\(await hash\(provided\),await hash\(env\.NGAD_TEST_LOGIN_TOKEN\)\)/);
 assert.match(worker,/WHERE username='NGAD' AND enabled=1 AND role='institution_admin' AND global_admin=1/);
 assert.match(worker,/ngad-test-consumed:/);
});
