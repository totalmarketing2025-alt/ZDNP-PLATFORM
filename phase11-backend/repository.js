// Read-only, tenant-scoped analytics and user listing through restricted app DB role.
// No credential/session reads or writes are exposed.
export async function withTenant(pool,principal,operation){
 if(!principal?.verified||!principal?.institutionId||!principal?.staffId)throw new Error('verified principal required');
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ ONLY');
  await client.query("SELECT set_config('app.institution_id',$1,true)",[principal.institutionId]);
  await client.query("SELECT set_config('app.staff_id',$1,true)",[principal.staffId]);
  const result=await operation(client);
  await client.query('COMMIT');return result;
 }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}finally{client.release()}
}
export async function listVisibleCases(pool,principal){
 return withTenant(pool,principal,async c=>(await c.query('SELECT id,case_number,category,status,created_at FROM cases ORDER BY created_at DESC LIMIT 50')).rows);
}
export async function staffDashboard(pool,principal){
 if(!['educator','director'].includes(principal?.role))throw new Error('forbidden');
 const cases=await listVisibleCases(pool,principal);
 return {total:cases.length,byStatus:Object.fromEntries([...new Set(cases.map(c=>c.status))].map(status=>[status,cases.filter(c=>c.status===status).length])),cases};
}
