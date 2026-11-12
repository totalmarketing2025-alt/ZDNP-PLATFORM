import test from 'node:test';import assert from 'node:assert/strict';import worker,{passwordHash} from './src/worker.js';
test('password hash is salted and plaintext is not stored',async()=>{const a=await passwordHash('example-staging-password');const b=await passwordHash('example-staging-password');assert.notEqual(a,b);assert.ok(!a.includes('example-staging-password'))});
test('weak password rejected',async()=>await assert.rejects(()=>passwordHash('plata2020')));
test('missing D1 fails closed',async()=>{const response=await worker.fetch(new Request('https://staging.example.invalid/api/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{});assert.equal(response.status,503)});
test('origin mismatch blocked',async()=>{const response=await worker.fetch(new Request('https://staging.example.invalid/api/login',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:'{}'}),{DB:{}});assert.equal(response.status,403)});
