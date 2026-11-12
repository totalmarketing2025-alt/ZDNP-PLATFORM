// Phase 9: trusted internal transaction service. No public API.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions={
 assign:{from:'received',to:'assigned',role:'educator'},
 forward:{from:'assigned',to:'forwarded',role:'educator'},
 answer:{from:'forwarded',to:'answered',role:'director'},
 close:{from:'answered',to:'closed',role:'director'}
};
export function validateCommand(principal,command){
 if(principal?.verified!==true||principal?.mfaVerified!==true||
 !uuid.test(principal.institutionId||'')||!uuid.test(principal.staffId||'')||
 !uuid.test(command?.caseId||'')||!Object.hasOwn(actions,command?.action||''))throw new Error('invalid or unverified command');
 return actions[command.action];
}
export async function executeCaseAction(pool,principal,command){
 const rule=validateCommand(principal,command);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Never trust a role provided by the caller. Verify staff within the DB.
  const staffResult=await client.query('SELECT id,institution_id,role,enabled FROM staff_users WHERE id=$1 AND institution_id=$2 AND enabled=true',[principal.staffId,principal.institutionId]);
  const staff=staffResult.rows[0];
  if(!staff||staff.role!==rule.role)throw new Error('forbidden');
  const result=await client.query('SELECT id,institution_id,status,confidential,assigned_to FROM cases WHERE id=$1 FOR UPDATE',[command.caseId]);
  const c=result.rows[0];
  if(!c||c.institution_id!==principal.institutionId||c.confidential||c.status!==rule.from)throw new Error('forbidden or invalid state');
  if(command.action==='assign'&&c.assigned_to)throw new Error('already assigned');
  if(command.action==='forward'&&c.assigned_to!==principal.staffId)throw new Error('not assigned to actor');
  if(command.action==='assign'){
   await client.query('UPDATE cases SET status=$1,assigned_to=$2,updated_at=now() WHERE id=$3',[rule.to,principal.staffId,c.id]);
  }else{
   await client.query('UPDATE cases SET status=$1,updated_at=now() WHERE id=$2',[rule.to,c.id]);
  }
  await client.query('INSERT INTO case_events(case_id,actor_id,event_type,event_metadata) VALUES ($1,$2,$3,$4::jsonb)',[c.id,principal.staffId,command.action,JSON.stringify({from:rule.from,to:rule.to})]);
  await client.query('COMMIT');
  return {caseId:c.id,status:rule.to};
 }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
 finally{client.release()}
}
