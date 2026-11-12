import {scryptSync,randomBytes,timingSafeEqual} from 'node:crypto';
export const roles=Object.freeze(['educator','director','service_head','archivist','institution_admin']);
export function hashPassword(password,salt=randomBytes(16)){
 if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('password policy');
 return salt.toString('hex')+':'+scryptSync(password,salt,64).toString('hex');
}
export function verifyPassword(password,stored){
 try{const [salt,hash]=stored.split(':');const expected=Buffer.from(hash,'hex');const actual=scryptSync(password,Buffer.from(salt,'hex'),expected.length);return expected.length===64&&timingSafeEqual(expected,actual)}catch{return false}
}
export function authorizeAdmin(actor,target,action){
 if(!actor||actor.role!=='institution_admin'||actor.enabled!==true||actor.authenticated!==true) return false;
 if(!target||target.institutionId!==actor.institutionId)return false;
 if(action==='delete'&&target.id===actor.id)return false;
 return ['create','disable','delete','reset-password','change-role'].includes(action);
}
export function validateUser({username,role,institutionId}){
 return typeof username==='string'&&/^[A-Za-z0-9_.-]{3,32}$/.test(username)&&roles.includes(role)&&typeof institutionId==='string'&&institutionId.length>0;
}
export function aggregateActivity(events,actor,institutionId){
 if(!actor||actor.role!=='institution_admin'||!actor.authenticated||actor.institutionId!==institutionId)throw new Error('forbidden');
 const scoped=events.filter(e=>e.institutionId===institutionId&&!e.confidential);
 return {total:scoped.length,byAction:Object.fromEntries([...new Set(scoped.map(e=>e.action))].map(a=>[a,scoped.filter(e=>e.action===a).length]))};
}
