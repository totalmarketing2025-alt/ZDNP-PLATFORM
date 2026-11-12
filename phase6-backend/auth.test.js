import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStaffSession,assertVerifiedPrincipal,AuthenticationUnavailableError} from './auth.js';
test('unconfigured identity provider denies all sessions',async()=>{
 await assert.rejects(()=>verifyStaffSession({}),AuthenticationUnavailableError);
});
test('unverified identities are denied',()=>{
 assert.throws(()=>assertVerifiedPrincipal({verified:false,mfaVerified:true}),AuthenticationUnavailableError);
});
test('MFA cannot be omitted',()=>{
 assert.throws(()=>assertVerifiedPrincipal({verified:true,mfaVerified:false,institutionId:'00000000-0000-4000-8000-000000000001',staffId:'00000000-0000-4000-8000-000000000002'}),AuthenticationUnavailableError);
});
test('verified MFA principal passes shape validation',()=>{
 const p={verified:true,mfaVerified:true,institutionId:'00000000-0000-4000-8000-000000000001',staffId:'00000000-0000-4000-8000-000000000002'};
 assert.deepEqual(assertVerifiedPrincipal(p),{institutionId:p.institutionId,staffId:p.staffId});
});
