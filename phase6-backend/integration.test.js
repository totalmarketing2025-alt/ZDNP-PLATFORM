import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createDatabase} from './db.js';
const url=process.env.TEST_DATABASE_URL;
const skip=!url;
const ed='00000000-0000-4000-8000-000000000011';
const dir='00000000-0000-4000-8000-000000000012';
const other='00000000-0000-4000-8000-000000000013';
const principal=(institutionId,staffId)=>({verified:true,mfaVerified:true,institutionId,staffId});
test('PostgreSQL RLS prevents cross-institution and unauthorized case reads',{skip},async()=>{
 const owner=new pg.Client({connectionString:url});await owner.connect();
 const db=createDatabase(process.env.APP_DATABASE_URL);
 try{
  await owner.query('BEGIN');
  // Migration 001 already seeds these institutions with generated UUIDs.
  // Reuse those canonical IDs instead of trying to overwrite existing rows.
  const institutionRows=await owner.query("SELECT code,id FROM institutions WHERE code IN ('IDR','PRI')");
  const ids=Object.fromEntries(institutionRows.rows.map(r=>[r.code,r.id]));
  const idr=ids.IDR, pri=ids.PRI;
  assert.ok(idr && pri,'migration 001 must seed IDR and PRI');
  await owner.query("INSERT INTO staff_users(id,institution_id,email,display_name,role,enabled) VALUES ($1,$2,'ed@example.invalid','Demo Educator','educator',true),($3,$2,'dir@example.invalid','Demo Director','director',true),($4,$5,'other@example.invalid','Demo Other','educator',true)",[ed,idr,dir,other,pri]);
  await owner.query("INSERT INTO cases(institution_id,case_number,category,subject,encrypted_payload,status,assigned_to) VALUES ($1,'TEST-IDR-001','request','IDR intake',decode('aa','hex'),'received',NULL),($2,'TEST-PRI-001','request','PRI intake',decode('aa','hex'),'received',NULL),($1,'TEST-IDR-002','question','IDR director',decode('aa','hex'),'forwarded',$3),($1,'TEST-IDR-003','complaint','IDR confidential',decode('aa','hex'),'triage',NULL)",[idr,pri,ed]);
  await owner.query("UPDATE cases SET confidential=true WHERE case_number='TEST-IDR-003'");
  await owner.query('COMMIT');
  const educatorCases=await db.listCases(principal(idr,ed));
  assert.deepEqual(educatorCases.map(c=>c.case_number).sort(),['TEST-IDR-001','TEST-IDR-002']);
  const directorCases=await db.listCases(principal(idr,dir));
  assert.deepEqual(directorCases.map(c=>c.case_number),['TEST-IDR-002']);
  const otherCases=await db.listCases(principal(pri,other));
  assert.deepEqual(otherCases.map(c=>c.case_number),['TEST-PRI-001']);
  await assert.rejects(()=>db.listCases({verified:false,mfaVerified:true,institutionId:idr,staffId:ed}));
  const app=new pg.Client({connectionString:process.env.APP_DATABASE_URL});await app.connect();
  try{
   await assert.rejects(()=>app.query("INSERT INTO cases(institution_id,case_number,category,subject,encrypted_payload) VALUES ($1,'BAD','request','No',decode('aa','hex'))",[idr]));
   const noContext=await app.query('SELECT count(*)::int AS n FROM cases');
   assert.equal(noContext.rows[0].n,0);
  }finally{await app.end()}
 }finally{await db.close();await owner.end()}
});
