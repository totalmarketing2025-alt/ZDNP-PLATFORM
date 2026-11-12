// Phase 11.1: trusted server-only PostgreSQL identity repository.
// Pool MUST use an isolated auth role, never the read-only case role.
import {randomBytes,createHash} from 'node:crypto';
import {hashPassword,verifyPassword} from '../phase10-admin/admin.js';
const digest=t=>createHash('sha256').update(t).digest('hex');
const userName=u=>typeof u==='string'&&/^[A-Za-z0-9_.-]{3,32}$/.test(u);
export async function login(pool,username,password){
 if(!userName(username)||typeof password!=='string')return null;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query(`SELECT c.staff_id,c.password_hash,c.must_change_password,c.failed_attempts,c.locked_until,
    u.role,u.institution_id,u.enabled FROM admin_credentials c JOIN staff_users u ON u.id=c.staff_id
    WHERE c.username=$1 FOR UPDATE OF c`,[username]);
  const user=r.rows[0];
  if(!user||!user.enabled){await client.query('ROLLBACK');return null}
  if(user.locked_until&&new Date(user.locked_until)>new Date()){await client.query('ROLLBACK');return null}
  if(!verifyPassword(password,user.password_hash)){
   await client.query(`UPDATE admin_credentials SET failed_attempts=failed_attempts+1,
    locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE NULL END
    WHERE staff_id=$1`,[user.staff_id]);
   await client.query('COMMIT');return null;
  }
  await client.query('UPDATE admin_credentials SET failed_attempts=0,locked_until=NULL WHERE staff_id=$1',[user.staff_id]);
  const token=randomBytes(32).toString('hex');
  await client.query(`INSERT INTO admin_sessions(token_hash,staff_id,expires_at)
    VALUES($1,$2,now()+interval '8 hours')`,[digest(token),user.staff_id]);
  await client.query('INSERT INTO admin_audit(institution_id,actor_id,action) VALUES($1,$2,$3)',[user.institution_id,user.staff_id,'login']);
  await client.query('COMMIT');
  return {token,mustChangePassword:user.must_change_password,role:user.role};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function authenticate(pool,token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
 const r=await pool.query(`SELECT u.id AS "staffId",u.institution_id AS "institutionId",u.role,
  c.must_change_password AS "mustChangePassword"
  FROM admin_sessions s JOIN staff_users u ON u.id=s.staff_id
  JOIN admin_credentials c ON c.staff_id=u.id
  WHERE s.token_hash=$1 AND s.expires_at>now() AND u.enabled=true`,[digest(token)]);
 return r.rows[0]||null;
}
export async function logout(pool,token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return;
 await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[digest(token)]);
}
export async function createStaff(pool,actor,{username,password,role,displayName,email}){
 if(actor?.role!=='institution_admin'||actor?.mustChangePassword||!actor?.institutionId||!actor?.staffId)throw Error('forbidden');
 if(!userName(username)||typeof password!=='string'||password.length<12||!['educator','director','service_head','institution_admin'].includes(role)
 ||typeof displayName!=='string'||!displayName.trim()||typeof email!=='string'||!email.includes('@'))throw Error('invalid user');
 const passwordHash=hashPassword(password);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const staff=await client.query(`INSERT INTO staff_users(institution_id,email,display_name,role,enabled)
    VALUES($1,$2,$3,$4,true) RETURNING id`,[actor.institutionId,email,displayName,role]);
  const id=staff.rows[0].id;
  await client.query('INSERT INTO admin_credentials(staff_id,username,password_hash) VALUES($1,$2,$3)',[id,username,passwordHash]);
  await client.query('INSERT INTO admin_audit(institution_id,actor_id,target_id,action) VALUES($1,$2,$3,$4)',[actor.institutionId,actor.staffId,id,'create-user']);
  await client.query('COMMIT');return {id,username,role};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function changeStaff(pool,actor,targetId,action,password){
 if(actor?.role!=='institution_admin'||actor?.mustChangePassword||!actor?.institutionId||!actor?.staffId||targetId===actor.staffId)throw Error('forbidden');
 if(!['disable','reset-password'].includes(action))throw Error('invalid action');
 const hash=action==='reset-password'?hashPassword(password):null;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const target=await client.query('SELECT id FROM staff_users WHERE id=$1 AND institution_id=$2 FOR UPDATE',[targetId,actor.institutionId]);
  if(!target.rowCount)throw Error('forbidden');
  if(action==='disable'){
   await client.query('UPDATE staff_users SET enabled=false WHERE id=$1',[targetId]);
   await client.query('DELETE FROM admin_sessions WHERE staff_id=$1',[targetId]);
  }else{
   await client.query('UPDATE admin_credentials SET password_hash=$2,must_change_password=true,password_changed_at=now() WHERE staff_id=$1',[targetId,hash]);
   await client.query('DELETE FROM admin_sessions WHERE staff_id=$1',[targetId]);
  }
  await client.query('INSERT INTO admin_audit(institution_id,actor_id,target_id,action) VALUES($1,$2,$3,$4)',[actor.institutionId,actor.staffId,targetId,action]);
  await client.query('COMMIT');return true;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function listStaff(pool,actor){
 if(actor?.role!=='institution_admin'||actor?.mustChangePassword)throw Error('forbidden');
 const r=await pool.query(`SELECT u.id,c.username,u.display_name,u.role,u.enabled
 FROM staff_users u JOIN admin_credentials c ON c.staff_id=u.id
 WHERE u.institution_id=$1 ORDER BY u.created_at DESC LIMIT 100`,[actor.institutionId]);
 return r.rows;
}
export async function auditSummary(pool,actor){
 if(actor?.role!=='institution_admin'||actor?.mustChangePassword)throw Error('forbidden');
 const r=await pool.query(`SELECT action,count(*)::int AS count FROM admin_audit
 WHERE institution_id=$1 GROUP BY action ORDER BY action`,[actor.institutionId]);
 return r.rows;
}
