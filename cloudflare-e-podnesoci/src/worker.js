// Cloudflare-only staging API. No hardcoded user/password or public bootstrap.
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra}});
const bytes=s=>new TextEncoder().encode(s);
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',bytes(s)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const pbkdf=async(password,salt,iterations=310000)=>{
 const k=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations,hash:'SHA-256'},k,256));
};
const secureCompare=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('password policy');const salt=random();return 'pbkdf2-sha256:310000:'+salt+':'+await pbkdf(password,salt)}
async function passwordVerify(password,stored){try{const [algo,count,salt,value]=stored.split(':');if(algo!=='pbkdf2-sha256'||Number(count)!==310000||!password||password.length>256)return false;return secureCompare(value,await pbkdf(password,salt))}catch{return false}}
const roles=new Set(['educator','director','service_head','archivist','institution_admin']);
const userName=s=>typeof s==='string'&&/^[a-zA-Z0-9_.-]{3,32}$/.test(s);
const audit=(db,actor,action,target)=>db.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(actor.institution_id,actor.id,target||null,action).run();
async function current(db,request){
 const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const user=await db.prepare(`SELECT u.id,u.username,u.role,u.institution_id,u.enabled,u.must_change_password
 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.enabled=1`).bind(await hash(token)).first();
 return user?{...user,token}:null;
}
async function parse(request){const raw=await request.text();if(raw.length>12000)throw Error('payload too large');return JSON.parse(raw||'{}')}
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):json({error:'assets unavailable'},503);
 if(path==='/api/health'&&method==='GET')return json({ok:true,environment:'staging'});
 if(!env.DB)return json({error:'D1 not configured'},503);
 if(method!=='GET'){
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return json({error:'invalid origin'},403);
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))return json({error:'JSON required'},415);
 }
 try{
  if(path==='/api/login'&&method==='POST'){
   const {username,password}=await parse(request);
   if(!userName(username)||typeof password!=='string')return json({error:'invalid credentials'},401);
   const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
   if(!user||!user.enabled||user.locked_until&&new Date(user.locked_until)>new Date()||!await passwordVerify(password,user.password_hash))return json({error:'invalid credentials'},401);
   const token=random(),tokenHash=await hash(token);
   await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+8 hours'))").bind(tokenHash,user.id),
    env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,action) VALUES(?,?,?)').bind(user.institution_id,user.id,'login')
   ]);
   return json({ok:true,mustChangePassword:!!user.must_change_password},200,{'set-cookie':`sid=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
  }
  const actor=await current(env.DB,request);
  if(!actor)return json({error:'unauthorized'},401);
  if(path==='/api/logout'&&method==='POST'){
   await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(actor.token)).run();
   return json({ok:true},200,{'set-cookie':'sid=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if(path==='/api/me'&&method==='GET')return json({id:actor.id,username:actor.username,role:actor.role,institutionId:actor.institution_id,mustChangePassword:!!actor.must_change_password});
  if(path==='/api/change-password'&&method==='POST'){
   const b=await parse(request);
   if(!await passwordVerify(b.oldPassword,(await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(actor.id).first()).password_hash))return json({error:'invalid credentials'},401);
   const password_hash=await passwordHash(b.newPassword);
   await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?').bind(password_hash,actor.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(actor.id),
    env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,action) VALUES(?,?,?)').bind(actor.institution_id,actor.id,'change-password')
   ]);
   return json({ok:true,loginAgain:true});
  }
  if(actor.must_change_password)return json({error:'change password required'},403);
  if(path==='/api/cases'&&method==='GET'){
   if(!['educator','director'].includes(actor.role))return json({error:'forbidden'},403);
   const rows=await env.DB.prepare(`SELECT id,case_number,category,status,created_at FROM cases
    WHERE institution_id=? AND confidential=0 AND
    ((?='educator' AND (assigned_to IS NULL OR assigned_to=?))
     OR (?='director' AND status IN ('forwarded','answered','closed')))
    ORDER BY created_at DESC LIMIT 50`).bind(actor.institution_id,actor.role,actor.id,actor.role).all();
   return json({cases:rows.results});
  }
  if(actor.role!=='institution_admin')return json({error:'forbidden'},403);
  if(path==='/api/users'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT id,username,display_name,role,enabled,must_change_password FROM users WHERE institution_id=? ORDER BY created_at DESC LIMIT 100').bind(actor.institution_id).all();
   return json({users:rows.results.map(u=>({...u,institutionId:actor.institution_id}))});
  }
  if(path==='/api/analytics'&&method==='GET'){
   const counts=await env.DB.prepare('SELECT action,count(*) AS count FROM audit_events WHERE institution_id=? GROUP BY action').bind(actor.institution_id).all();
   const recent=await env.DB.prepare('SELECT actor_id AS actorId,action,created_at AS at FROM audit_events WHERE institution_id=? ORDER BY id DESC LIMIT 50').bind(actor.institution_id).all();
   return json({total:counts.results.reduce((a,x)=>a+x.count,0),byAction:counts.results,recent:recent.results});
  }
  if(path==='/api/users'&&method==='POST'){
   const b=await parse(request);
   if(!userName(b.username)||!roles.has(b.role)||typeof b.displayName!=='string'||!b.displayName.trim())return json({error:'invalid user'},400);
   const password_hash=await passwordHash(b.password),id=crypto.randomUUID();
   await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,institution_id,username,role,display_name,password_hash) VALUES(?,?,?,?,?,?)').bind(id,actor.institution_id,b.username,b.role,b.displayName,password_hash),
    env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(actor.institution_id,actor.id,id,'create-user')
   ]);
   return json({id,username:b.username,role:b.role},201);
  }
  const match=path.match(/^\/api\/users\/([a-f0-9-]{36})\/(disable|delete|reset-password)$/);
  if(match&&method==='POST'){
   const [,id,action]=match;
   if(id===actor.id)return json({error:'cannot modify self'},403);
   const target=await env.DB.prepare('SELECT id FROM users WHERE id=? AND institution_id=?').bind(id,actor.institution_id).first();
   if(!target)return json({error:'forbidden'},403);
   const statements=[];
   if(action==='reset-password'){
    const b=await parse(request);statements.push(env.DB.prepare('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=? AND institution_id=?').bind(await passwordHash(b.password),id,actor.institution_id));
   }else statements.push(env.DB.prepare('UPDATE users SET enabled=0 WHERE id=? AND institution_id=?').bind(id,actor.institution_id));
   statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
   statements.push(env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(actor.institution_id,actor.id,id,action));
   await env.DB.batch(statements);return json({ok:true});
  }
  return json({error:'not found'},404);
 }catch(e){return json({error:'request failed'},400)}
}};
