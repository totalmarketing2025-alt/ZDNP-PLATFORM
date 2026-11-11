import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
const ownerUrl=process.env.TEST_DATABASE_URL,appUrl=process.env.APP_DATABASE_URL;
test('transactional PostgreSQL case updates enforce scope and atomic audit',{skip:!ownerUrl||!appUrl},async()=>{
 const owner=new pg.Client({connectionString:ownerUrl}),app=new pg.Client({connectionString:appUrl});
 await owner.connect();await app.connect();
 try{
  const inst=await owner.query("SELECT code,id FROM institutions WHERE code IN ('IDR','PRI')");
  const ids=Object.fromEntries(inst.rows.map(r=>[r.code,r.id]));
  assert.ok(ids.IDR&&ids.PRI);
  const staff=await owner.query("INSERT INTO staff_users(institution_id,email,display_name,role,identity_provider_subject,enabled) VALUES ($1,'phase9ed@example.invalid','Test Educator','educator','test-oidc-educator',true),($1,'phase9dir@example.invalid','Test Director','director','test-oidc-director',true),($2,'phase9other@example.invalid','Test Other','educator','test-oidc-other',true) RETURNING id",[ids.IDR,ids.PRI]);
  const cases=await owner.query("INSERT INTO cases(institution_id,case_number,category,subject,encrypted_payload,status,confidential) VALUES ($1,'P9-001','request','Test',decode('aa','hex'),'received',false),($1,'P9-002','complaint','Private test',decode('aa','hex'),'received',true) RETURNING id",[ids.IDR]);
  const [caseId,confidentialId]=cases.rows.map(r=>r.id);
  const call=(subject,id,action)=>app.query('SELECT auth_private.transition_case($1,$2,$3) AS status',[subject,id,action]);
  await assert.rejects(()=>call('test-oidc-other',caseId,'assign'));
  await assert.rejects(()=>call('test-oidc-educator',confidentialId,'assign'));
  await assert.rejects(()=>call('test-oidc-director',caseId,'answer'));
  assert.equal((await call('test-oidc-educator',caseId,'assign')).rows[0].status,'assigned');
  await assert.rejects(()=>call('test-oidc-educator',caseId,'assign'));
  assert.equal((await call('test-oidc-educator',caseId,'forward')).rows[0].status,'forwarded');
  assert.equal((await call('test-oidc-director',caseId,'answer')).rows[0].status,'answered');
  assert.equal((await call('test-oidc-director',caseId,'close')).rows[0].status,'closed');
  const events=await owner.query('SELECT event_type FROM case_events WHERE case_id=$1 ORDER BY occurred_at,id',[caseId]);
  assert.equal(events.rowCount,4);
  assert.deepEqual(new Set(events.rows.map(x=>x.event_type)),new Set(['assign','forward','answer','close']));
  const state=await owner.query('SELECT status FROM cases WHERE id=$1',[caseId]);
  assert.equal(state.rows[0].status,'closed');
  await assert.rejects(()=>app.query("UPDATE cases SET status='received' WHERE id=$1",[caseId]));
  await assert.rejects(()=>app.query("INSERT INTO case_events(case_id,event_type) VALUES ($1,'fake')",[caseId]));
 }finally{await app.end();await owner.end()}
});
