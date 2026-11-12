import test from 'node:test';
import assert from 'node:assert/strict';
import {hasMfa,allowedRole,allowedToReadCases} from './policy.js';
test('single factor tokens fail',()=>{assert.equal(hasMfa({amr:['pwd']}),false);assert.equal(hasMfa({}),false)});
test('explicit MFA method accepted',()=>{assert.equal(hasMfa({amr:['pwd','otp']}),true)});
test('unknown role denied',()=>{assert.equal(allowedRole('superadmin'),false)});
test('institution admin cannot read cases',()=>{assert.equal(allowedToReadCases('institution_admin'),false)});
