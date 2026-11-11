import http from 'node:http';
import pg from 'pg';
import {verifyBearer,configured} from './identity.js';
import {allowedRole,allowedToReadCases} from './policy.js';
const {Pool}=pg;
export function createApp({pool,verify=verifyBearer}){
 return http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});res.end(JSON.stringify(body));};
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method!=='GET'||!['/api/me','/api/cases'].includes(path))return send(404,{error:'not found'});
  let subject;
  try{subject=await verify(req.headers.authorization)}catch{return send(401,{error:'unauthorized'})}
  const client=await pool.connect();
  try{
   await client.query('BEGIN READ ONLY');
   // Identity is resolved server-side; never trust institution or role from client.
   const found=await client.query('SELECT id,institution_id,role,display_name FROM staff_users WHERE identity_provider_subject=$1 AND enabled=true LIMIT 1',[subject]);
   const staff=found.rows[0];
   if(!staff||!allowedRole(staff.role)){await client.query('ROLLBACK');return send(403,{error:'forbidden'})}
   await client.query("SELECT set_config('app.institution_id',$1,true)",[staff.institution_id]);
   await client.query("SELECT set_config('app.staff_id',$1,true)",[staff.id]);
   if(path==='/api/me'){await client.query('COMMIT');return send(200,{displayName:staff.display_name,role:staff.role,institutionId:staff.institution_id})}
   if(!allowedToReadCases(staff.role)){await client.query('ROLLBACK');return send(403,{error:'forbidden'})}
   const result=await client.query('SELECT case_number,category,subject,status,created_at FROM cases ORDER BY created_at DESC LIMIT 50');
   await client.query('COMMIT');
   return send(200,{cases:result.rows});
  }catch(e){try{await client.query('ROLLBACK')}catch{}return send(500,{error:'server error'})}
  finally{client.release()}
 });
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 configured();
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
 const app=createApp({pool});
 const port=Number(process.env.PORT||8790);
 app.listen(port,'127.0.0.1',()=>console.log('Phase7 private API on loopback port '+port));
}
