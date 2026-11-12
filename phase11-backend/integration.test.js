import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
const ownerUrl=process.env.TEST_DATABASE_URL,appUrl=process.env.APP_DATABASE_URL;
test('phase11 tables exist, have RLS, and deny app direct credential access',{skip:!ownerUrl||!appUrl},async()=>{
 const owner=new pg.Client({connectionString:ownerUrl}),app=new pg.Client({connectionString:appUrl});
 await owner.connect();await app.connect();
 try{
  const names=['admin_credentials','admin_sessions','admin_audit'];
  const result=await owner.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)',[names]);
  assert.equal(result.rowCount,3);
  for(const r of result.rows){assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true)}
  for(const table of names)await assert.rejects(()=>app.query('SELECT * FROM '+table));
  const institutions=await owner.query("SELECT code,id FROM institutions WHERE code IN ('IDR','PRI')");
  assert.equal(institutions.rowCount,2);
  const idr=institutions.rows.find(r=>r.code==='IDR').id;
  const pri=institutions.rows.find(r=>r.code==='PRI').id;
  await owner.query("INSERT INTO admin_audit(institution_id,action) VALUES ($1,'demo-create'),($2,'demo-disable')",[idr,pri]);
  const audit=await owner.query('SELECT institution_id,action FROM admin_audit ORDER BY id');
  assert.equal(audit.rowCount,2);
  assert.notEqual(audit.rows[0].institution_id,audit.rows[1].institution_id);
 }finally{await app.end();await owner.end()}
});
