import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandbox,staff} from './core.js';
test('no repeat assignment allowed',()=>{
 const db=createSandbox(),u=staff['demo-idr-educator'];
 assert.equal(db.transition(u,'DEMO-IDR-001','assign').ok,true);
 assert.equal(db.transition(u,'DEMO-IDR-001','assign').code,409);
 assert.equal(db.events.length,1);
});
test('another institution cannot mutate case',()=>{
 const db=createSandbox(),u=staff['demo-pri-educator'];
 assert.equal(db.transition(u,'DEMO-IDR-001','assign').code,403);
 assert.equal(db.events.length,0);
});
test('staff cannot act on confidential complaint',()=>{
 const db=createSandbox();
 for(const user of Object.values(staff))assert.equal(db.transition(user,'DEMO-IDR-003','assign').code,403);
});
test('director cannot answer twice',()=>{
 const db=createSandbox(),director=staff['demo-idr-director'];
 assert.equal(db.transition(director,'DEMO-IDR-002','answer').ok,true);
 assert.equal(db.transition(director,'DEMO-IDR-002','answer').code,409);
});
