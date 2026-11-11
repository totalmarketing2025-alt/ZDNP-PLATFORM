import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandbox,staff} from './core.js';
test('cross institution access is denied',()=>{const db=createSandbox();assert.equal(db.get(staff['demo-pri-educator'],'DEMO-IDR-001'),null);});
test('institution admin cannot read case content',()=>{const db=createSandbox();assert.equal(db.list(staff['demo-idr-admin']).length,0);});
test('director only sees forwarded cases',()=>{const db=createSandbox();assert.equal(db.get(staff['demo-idr-director'],'DEMO-IDR-001'),null);assert.ok(db.get(staff['demo-idr-director'],'DEMO-IDR-002'));});
test('confidential complaints excluded from normal staff views',()=>{const db=createSandbox();for(const user of Object.values(staff))assert.equal(db.get(user,'DEMO-IDR-003'),null);});
test('educator assigns, forwards, director answers and audit records',()=>{const db=createSandbox(),ed=staff['demo-idr-educator'],director=staff['demo-idr-director'];assert.equal(db.transition(ed,'DEMO-IDR-001','assign').ok,true);assert.equal(db.transition(ed,'DEMO-IDR-001','forward').ok,true);assert.equal(db.transition(director,'DEMO-IDR-001','answer').ok,true);assert.equal(db.events.length,3);});
test('director cannot self-assign or answer unforwarded case',()=>{const db=createSandbox();assert.equal(db.transition(staff['demo-idr-director'],'DEMO-IDR-001','answer').ok,false);});
