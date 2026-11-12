import test from 'node:test';import assert from 'node:assert/strict';import {login,authenticate,createStaff,changeStaff,listStaff,auditSummary} from './auth.js';
test('invalid username rejects without touching DB',async()=>{assert.equal(await login(null,'!invalid','password'),null)});
test('malformed session rejects without touching DB',async()=>{assert.equal(await authenticate(null,'bad'),null)});
test('non-admin cannot create users',async()=>{await assert.rejects(()=>createStaff(null,{role:'educator'},{username:'staff',password:'longpassword123',role:'educator',displayName:'Test',email:'test@example.org'}),/forbidden/)});
test('admin cannot disable self',async()=>{await assert.rejects(()=>changeStaff(null,{role:'institution_admin',institutionId:'i',staffId:'s'},'s','disable'),/forbidden/)});
test('non-admin cannot read user directory or analytics',async()=>{await assert.rejects(()=>listStaff(null,{role:'educator'}),/forbidden/);await assert.rejects(()=>auditSummary(null,{role:'educator'}),/forbidden/)});
