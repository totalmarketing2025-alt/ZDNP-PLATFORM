import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {hashPassword} from '../phase10-admin/admin.js';
import {login,authenticate,createStaff,changeStaff,listStaff,auditSummary,logout} from './auth.js';
const url=process.env.TEST_DATABASE_URL;
test('real PostgreSQL login, create, revoke, analytics and tenant isolation',{skip:!url},async()=>{
 const pool=new pg.Pool({connectionString:url,max:3});
 try{
  const inst=await pool.query("SELECT code,id FROM institutions WHERE code IN ('IDR','PRI')");
  const idr=inst.rows.find(r=>r.code==='IDR').id,pri=inst.rows.find(r=>r.code==='PRI').id;
  const a=await pool.query("INSERT INTO staff_users(institution_id,email,display_name,role,enabled) VALUES($1,'ngad@example.invalid','NGAD','institution_admin',true) RETURNING id",[idr]);
  const id=a.rows[0].id;
  await pool.query("INSERT INTO admin_credentials(staff_id,username,password_hash,must_change_password) VALUES($1,'NGAD',$2,false)",[id,hashPassword('example-private-test-password')]);
  assert.equal(await login(pool,'NGAD','wrong-pass'),null);
  const auth=await login(pool,'NGAD','example-private-test-password');
  assert.ok(auth?.token);const actor=await authenticate(pool,auth.token);
  assert.equal(actor.institutionId,idr);assert.equal(actor.role,'institution_admin');
  const created=await createStaff(pool,actor,{username:'educator01',password:'example-educator-password',role:'educator',displayName:'Example Educator',email:'educator@example.invalid'});
  assert.ok(created.id);
  assert.equal((await listStaff(pool,actor)).length,2);
  assert.ok((await auditSummary(pool,actor)).some(x=>x.action==='create-user'));
  const other=await pool.query("INSERT INTO staff_users(institution_id,email,display_name,role,enabled) VALUES($1,'other@example.invalid','Other','educator',true) RETURNING id",[pri]);
  await assert.rejects(()=>changeStaff(pool,actor,other.rows[0].id,'disable'),/forbidden/);
  await changeStaff(pool,actor,created.id,'disable');
  assert.equal((await pool.query('SELECT enabled FROM staff_users WHERE id=$1',[created.id])).rows[0].enabled,false);
  await logout(pool,auth.token);assert.equal(await authenticate(pool,auth.token),null);
 }finally{await pool.end()}
});
