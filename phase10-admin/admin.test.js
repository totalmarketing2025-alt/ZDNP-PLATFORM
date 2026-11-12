import test from 'node:test';import assert from 'node:assert/strict';import {hashPassword,verifyPassword,authorizeAdmin,validateUser,aggregateActivity} from './admin.js';
const admin={id:'a',institutionId:'IDR',role:'institution_admin',enabled:true,authenticated:true};
test('passwords are salted and never stored in plaintext',()=>{const a=hashPassword('a-long-example-password');const b=hashPassword('a-long-example-password');assert.notEqual(a,b);assert.ok(verifyPassword('a-long-example-password',a));assert.equal(verifyPassword('wrong-password',a),false)});
test('weak passwords rejected',()=>assert.throws(()=>hashPassword('plata2020')));
test('tenant isolation for user management',()=>{assert.equal(authorizeAdmin(admin,{id:'b',institutionId:'PRI'},'delete'),false);assert.equal(authorizeAdmin(admin,{id:'b',institutionId:'IDR'},'reset-password'),true)});
test('admin cannot delete own account',()=>assert.equal(authorizeAdmin(admin,{id:'a',institutionId:'IDR'},'delete'),false));
test('role validation',()=>{assert.ok(validateUser({username:'worker01',role:'educator',institutionId:'IDR'}));assert.equal(validateUser({username:'worker01',role:'superuser',institutionId:'IDR'}),false)});
test('analytics exclude other institutions and confidential cases',()=>assert.deepEqual(aggregateActivity([{institutionId:'IDR',action:'assign'},{institutionId:'PRI',action:'assign'},{institutionId:'IDR',action:'answer',confidential:true}],admin,'IDR'),{total:1,byAction:{assign:1}}));
