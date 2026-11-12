// Run locally only. Never paste the generated SQL into a public issue or commit it.
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {randomBytes,pbkdf2Sync,randomUUID} from 'node:crypto';
const rl=createInterface({input,output});
try{
 const answer=await rl.question('Choose a new NGAD password (12+ characters; input visible locally): ');
 if(answer.length<12||answer.length>256)throw Error('Password must contain 12–256 characters');
 const salt=randomBytes(32).toString('hex');
 const derived=pbkdf2Sync(answer,Buffer.from(salt,'utf8'),310000,32,'sha256').toString('hex');
 const hash='pbkdf2-sha256:310000:'+salt+':'+derived;
 const id=randomUUID();
 console.log('\nRun this SQL ONLY in your private staging D1 Console. Do not commit it:');
 console.log(`INSERT INTO users(id,institution_id,username,role,display_name,password_hash,enabled,must_change_password,global_admin) VALUES('${id}','IDR','NGAD','institution_admin','Central NGAD','${hash}',1,0,1);`);
 console.log('\nNGAD is anchored to IDR for legacy FK compatibility; global_admin=1 grants central administration. No confidential case access.');
}finally{rl.close()}
