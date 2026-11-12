import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('./src/worker.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('./migrations/0002_central_ngad.sql',import.meta.url),'utf8');
test('central privilege is opt-in, not automatic',()=>{assert.match(migration,/global_admin INTEGER NOT NULL DEFAULT 0/);assert.match(migration,/NEW.username<>'NGAD'/)});
test('central admin requires both privilege and NGAD identity',()=>assert.match(worker,/actor.global_admin===1&&actor.username==='NGAD'/));
test('staff case access remains scoped to institution and nonconfidential cases',()=>{assert.match(worker,/WHERE institution_id=\? AND confidential=0/);assert.match(worker,/assigned_to IS NULL OR assigned_to=\?/);});
test('central admin cannot create additional NGAD or modify another central account',()=>{assert.match(worker,/b.username.toUpperCase\(\)==='NGAD'/);assert.match(worker,/target.global_admin===1/);});
test('no deployment enabled by default',()=>{const config=readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');assert.match(config,/workers_dev = false/)});

test('local account operations bind actor institution, not uninitialized target',()=>assert.match(worker,/SELECT id,institution_id,global_admin FROM users WHERE id=\? AND institution_id=\?'\)\.bind\(id,actor\.institution_id\)/));
test('cross-institution disable uses target institution',()=>assert.match(worker,/UPDATE users SET enabled=0 WHERE id=\? AND institution_id=\?'\)\.bind\(id,target\.institution_id\)/));
test('Cloudflare Access requires cryptographically verified JWT and fails closed',()=>{assert.match(worker,/if\(!await verifyAccess\(request,env\)\)return json/);assert.match(worker,/crypto\.subtle\.verify\('RSASSA-PKCS1-v1_5'/);});
