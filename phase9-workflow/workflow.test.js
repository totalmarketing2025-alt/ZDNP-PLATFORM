import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCaseAction,validateCommand} from './workflow.js';
const inst='00000000-0000-4000-8000-000000000001',staff='00000000-0000-4000-8000-000000000002',caseId='00000000-0000-4000-8000-000000000003';
const principal={verified:true,mfaVerified:true,institutionId:inst,staffId:staff};
test('unverified identity is rejected',()=>assert.throws(()=>validateCommand({...principal,verified:false},{caseId,action:'assign'})));
test('unknown action is rejected',()=>assert.throws(()=>validateCommand(principal,{caseId,action:'delete'})));
test('successful assignment is atomic and audited',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('SELECT id,institution_id,role'))return {rows:[{id:staff,institution_id:inst,role:'educator',enabled:true}]};if(sql.startsWith('SELECT id,institution_id,status'))return {rows:[{id:caseId,institution_id:inst,status:'received',confidential:false,assigned_to:null}]};return {rows:[]}},release(){}};
 const result=await executeCaseAction({connect:async()=>client},principal,{caseId,action:'assign'});
 assert.equal(result.status,'assigned');assert.ok(calls.some(s=>s.startsWith('INSERT INTO case_events')));assert.equal(calls.at(-1),'COMMIT');
});
test('invalid transition rolls back without audit',async()=>{
 const calls=[];
 const client={query:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT id,institution_id,role'))return {rows:[{id:staff,institution_id:inst,role:'educator',enabled:true}]};if(sql.startsWith('SELECT id,institution_id,status'))return {rows:[{id:caseId,institution_id:inst,status:'closed',confidential:false,assigned_to:null}]};return {rows:[]}},release(){}};
 await assert.rejects(()=>executeCaseAction({connect:async()=>client},principal,{caseId,action:'assign'}));
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.some(s=>s.startsWith('INSERT INTO case_events')),false);
});
