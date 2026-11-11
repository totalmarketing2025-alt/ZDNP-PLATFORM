import pg from 'pg';
import {assertVerifiedPrincipal} from './auth.js';
// Only call with a principal from a verified MFA identity provider.
// This module is not connected to the public static website.
export function createDatabase(connectionString){
 if(!connectionString)throw new Error('DATABASE_URL required');
 const pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:5000});
 return {
  async listCases(principal){
   const {institutionId,staffId}=assertVerifiedPrincipal(principal);
   const client=await pool.connect();
   try{
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.institution_id',$1,true)",[institutionId]);
    await client.query("SELECT set_config('app.staff_id',$1,true)",[staffId]);
    const result=await client.query('SELECT id,case_number,category,subject,status,created_at FROM cases ORDER BY created_at DESC LIMIT 50');
    await client.query('COMMIT');
    return result.rows;
   }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
   finally{client.release()}
  },
  async close(){await pool.end()}
 };
}
