// ZDNP authenticated API. No hardcoded user/password or public bootstrap.
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
// An NGAD test token must be explicitly configured as a secret, be valid for
// at most four hours, and can create only one 30-minute session.
const ngadTestWindow=env=>{
 const until=Date.parse(env.NGAD_TEST_LOGIN_UNTIL||'');
 const remaining=until-Date.now();
 return typeof env.NGAD_TEST_LOGIN_TOKEN==='string'&&env.NGAD_TEST_LOGIN_TOKEN.length>=48&&
  Number.isFinite(until)&&remaining>0&&remaining<=4*60*60*1000;
};
async function ngadTestSignature(secret,token){
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,bytes(token)));
}
const cookie=(name,value,maxAge)=>`${name}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('password policy');const salt=random();return 'pbkdf2-sha256:310000:'+salt+':'+await pbkdf(password,salt)}
async function passwordVerify(password,stored){try{const [algo,count,salt,value]=stored.split(':');if(algo!=='pbkdf2-sha256'||Number(count)!==310000||!password||password.length>256)return false;return secureCompare(value,await pbkdf(password,salt))}catch{return false}}
const roles=new Set(['educator','director','service_head','archivist','institution_admin']);
const userName=s=>typeof s==='string'&&/^[a-zA-Z0-9_.-]{3,32}$/.test(s);
const audit=(db,actor,action,target)=>db.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(actor.institution_id,actor.id,target||null,action).run();
async function current(db,request,env){
 const rawCookies=request.headers.get('cookie')||'';
 const token=rawCookies.match(/(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 // Select the existing user row without assuming a later optional migration
 // (global_admin) was applied to the deployed D1 database.
 const user=await db.prepare(`SELECT u.*
 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.enabled=1`).bind(await hash(token)).first();
 if(!user)return null;
 const signed=rawCookies.match(/(?:^|;\s*)ngad_test=([a-f0-9]{64})(?:;|$)/)?.[1];
 const testAccess=!!(signed&&user.username==='NGAD'&&user.role==='institution_admin'&&
  user.global_admin===1&&ngadTestWindow(env)&&
  secureCompare(signed,await ngadTestSignature(env.NGAD_TEST_LOGIN_TOKEN,token)));
 return {...user,token,testAccess};
}
async function parse(request){const raw=await request.text();if(raw.length>12000)throw Error('payload too large');return JSON.parse(raw||'{}')}
const b64=value=>btoa(String.fromCharCode(...new Uint8Array(value)));
const unb64=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
async function submissionKey(secret){
 if(typeof secret!=='string'||secret.length<48)throw Error('submission encryption key is not configured');
 const raw=await crypto.subtle.digest('SHA-256',bytes(secret));
 return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptSubmission(payload,caseId,secret){
 const key=await submissionKey(secret),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(caseId)},key,bytes(JSON.stringify(payload)));
 return {ciphertext:b64(encrypted),iv:b64(iv)};
}
async function decryptSubmission(ciphertext,iv,caseId,secret){
 const key=await submissionKey(secret);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:bytes(caseId)},key,unb64(ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}
async function takePublicLimit(db,request,secret,purpose){
 if(typeof secret!=='string'||secret.length<48)return {configured:false};
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const fingerprint=hex(await crypto.subtle.sign('HMAC',key,bytes(purpose+':'+ip)));
 const windowStart=Math.floor(Date.now()/3600000)*3600;
 const row=await db.prepare(`INSERT INTO public_intake_limits(fingerprint,window_start,attempts)
 VALUES(?,?,1)
 ON CONFLICT(fingerprint) DO UPDATE SET
 attempts=CASE WHEN public_intake_limits.window_start=excluded.window_start
  THEN public_intake_limits.attempts+1 ELSE 1 END,
 window_start=excluded.window_start
 RETURNING attempts`).bind(fingerprint,windowStart).first();
 if(Math.random()<0.01)await db.prepare('DELETE FROM public_intake_limits WHERE window_start<?').bind(windowStart-86400).run();
 return {configured:true,allowed:Number(row?.attempts||0)<=5};
}
function validEmail(value){
 return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 // Public demo is a static mock only: no sessions, API or D1 access.
 if(path==='/demo'&&method==='GET'){
  if(!env.ASSETS)return json({error:'demo assets unavailable'},503);
  const demoUrl=new URL(request.url);demoUrl.pathname='/demo.html';
  return env.ASSETS.fetch(new Request(demoUrl,request));
 }
 // Temporary, explicitly routed mobile recovery page. Remove after recovery.
 if(path==='/recover-ngad'&&method==='GET'){
  if(!env.ASSETS)return json({error:'assets unavailable'},503);
  const assetUrl=new URL(request.url);assetUrl.pathname='/recover-ngad.html';assetUrl.search='';
  const asset=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!asset.ok)return json({error:'recovery page unavailable'},503);
  const headers=new Headers(asset.headers);
  headers.set('cache-control','no-store');
  headers.set('x-robots-tag','noindex, nofollow');
  headers.set('referrer-policy','no-referrer');
  headers.set('content-security-policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  headers.set('x-frame-options','DENY');
  return new Response(asset.body,{status:200,headers});
 }
 // User/password authentication is enforced by the D1-backed session endpoints.

 if(!path.startsWith('/api/')){
  if(method!=='GET'&&method!=='HEAD')return json({error:'method not allowed'},405);
  if(path!=='/najava'&&path!=='/dashboard')return json({error:'not found'},404);
  if(!env.ASSETS)return json({error:'assets unavailable'},503);
  // The Worker owns only explicitly routed portal paths; the existing website remains on Pages.
  // Workers Static Assets canonicalizes /index.html to / (HTTP 307).
  // Fetch the canonical root internally; the public URL stays /najava or /dashboard.
  const assetUrl=new URL(request.url);assetUrl.pathname='/';assetUrl.search='';
  const asset=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(!asset.ok||asset.status>=300&&asset.status<400)return json({error:'portal asset unavailable',assetStatus:asset.status},503,{'x-zdnp-worker':'portal'});
  if(!(asset.headers.get('content-type')||'').toLowerCase().includes('text/html'))return json({error:'portal asset is not HTML'},503,{'x-zdnp-worker':'portal'});
  const headers=new Headers(asset.headers);
  headers.set('cache-control','no-store');
  headers.set('x-zdnp-worker','portal');
  headers.set('x-content-type-options','nosniff');
  return new Response(asset.body,{status:asset.status,headers});
 }
 if(path==='/api/health'&&method==='GET')return json({ok:true,service:'zdnp-e-podnesoci'});
 if(!env.DB)return json({error:'D1 not configured'},503);
  if(path==='/api/public/submissions'&&method==='POST'){
   const throttle=await takePublicLimit(env.DB,request,env.PUBLIC_INTAKE_HMAC_KEY,'submit');
   if(!throttle.configured)return json({error:'public intake is not configured'},503);
   if(!throttle.allowed)return json({error:'too many submissions; try again later'},429,{'retry-after':'3600'});
   const body=await parse(request);
   if(!['request','petition'].includes(body.kind))return json({error:'this submission type requires a separate confidential review route'},409);
   const institution=String(body.institution||'');
   if(!['IDR','PRI','STI'].includes(institution))return json({error:'invalid institution'},400);
   const fullName=String(body.fullName||'').trim();
   const registryNumber=String(body.registryNumber||'').trim();
   const treatment=String(body.treatment||'');
   const subject=String(body.subject||'').trim();
   const message=String(body.body||'').trim();
   const email=String(body.email||'').trim();
   if(fullName.length<2||fullName.length>120||registryNumber.length<1||registryNumber.length>40||
      !['closed','semi-open','open'].includes(treatment)||subject.length<2||subject.length>180||
      message.length<10||message.length>6000||!validEmail(email)||String(body.website||'').trim())
    return json({error:'invalid submission fields'},400);
   if(typeof env.CASE_ENCRYPTION_KEY!=='string'||env.CASE_ENCRYPTION_KEY.length<48)
    return json({error:'secure intake is not configured'},503);
   const id=crypto.randomUUID();
   const caseNumber='ZDNP-'+new Date().getUTCFullYear()+'-'+id.replaceAll('-','').toUpperCase();
   const trackingToken=random();
   const encrypted=await encryptSubmission({
    kind:body.kind,institution,fullName,registryNumber,treatment,subject,message,email
   },id,env.CASE_ENCRYPTION_KEY);
   await env.DB.batch([
    env.DB.prepare('INSERT INTO cases(id,institution_id,case_number,category,status,confidential) VALUES(?,?,?,?,?,0)')
     .bind(id,institution,caseNumber,body.kind,'received'),
    env.DB.prepare('INSERT INTO case_submissions(case_id,payload_ciphertext,payload_iv) VALUES(?,?,?)')
     .bind(id,encrypted.ciphertext,encrypted.iv),
    env.DB.prepare('UPDATE cases SET tracking_token_hash=? WHERE id=?').bind(await hash(trackingToken),id),
    env.DB.prepare("INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?, 'public', ?, 'public-submission')")
     .bind(institution,id)
   ]);
   return json({ok:true,caseNumber,trackingToken},201);
  }
  if(path==='/api/public/status'&&method==='POST'){
   const throttle=await takePublicLimit(env.DB,request,env.PUBLIC_INTAKE_HMAC_KEY,'status');
   if(!throttle.configured)return json({error:'public status lookup is not configured'},503);
   if(!throttle.allowed)return json({error:'too many attempts; try again later'},429,{'retry-after':'3600'});
   const body=await parse(request);
   const caseNumber=String(body.caseNumber||'').trim().toUpperCase();
   const token=String(body.trackingToken||'').trim();
   if(!/^ZDNP-[0-9]{4}-[A-F0-9]{32}$/.test(caseNumber)||! /^[a-f0-9]{64}$/.test(token))
    return json({error:'case or tracking code not found'},404);
   const item=await env.DB.prepare('SELECT case_number,status,created_at FROM cases WHERE case_number=? AND tracking_token_hash=?')
    .bind(caseNumber,await hash(token)).first();
   if(!item)return json({error:'case or tracking code not found'},404);
   return json({caseNumber:item.case_number,status:item.status,createdAt:item.created_at});
  }
 if(method!=='GET'){
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return json({error:'invalid origin'},403);
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))return json({error:'JSON required'},415);
 }
 try{
  // A single-use passwordless test session for the existing NGAD account.
  // Requires a separate high-entropy Worker secret and short expiry. No other
  // username can use this endpoint and no password or hash is changed in D1.
  if(path==='/api/admin/test-login-ngad'&&method==='POST'){
   if(!ngadTestWindow(env))return json({error:'test access unavailable'},404);
   const {token:provided}=await parse(request);
   if(typeof provided!=='string'||provided.length<48||
      !secureCompare(await hash(provided),await hash(env.NGAD_TEST_LOGIN_TOKEN)))
    return json({error:'test access unavailable'},404);
   const admin=await env.DB.prepare("SELECT * FROM users WHERE username='NGAD' AND enabled=1 AND role='institution_admin' AND global_admin=1").first();
   if(!admin)return json({error:'NGAD test access unavailable'},409);
   const token=random(),tokenHash=await hash(token);
   // Atomic insert: an expired marker consumes the token only if a usable
   // session was created. The marker's primary key rejects all replays.
   const usedMarker=await hash('ngad-test-consumed:'+env.NGAD_TEST_LOGIN_TOKEN);
   try{
    await env.DB.batch([
     env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','-1 second'))").bind(usedMarker,admin.id),
     env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+30 minutes'))").bind(tokenHash,admin.id)
    ]);
   }catch(e){
    console.warn('auth.ngad.test_login_denied',{reason:'already_used_or_session_unavailable',errorName:e?.name||'Error'});
    return json({error:'test token already used or session unavailable'},409);
   }
   try{
    await env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,action) VALUES(?,?,?)').bind(admin.institution_id,admin.id,'ngad-test-login').run();
   }catch(e){console.error('auth.ngad.test_login_audit_failed',{errorName:e?.name||'Error'});}
   console.info('auth.ngad.test_session_created');
   const response=json({ok:true,username:'NGAD',expiresInSeconds:1800});
   response.headers.append('set-cookie',cookie('sid',token,1800));
   response.headers.append('set-cookie',cookie('ngad_test',await ngadTestSignature(env.NGAD_TEST_LOGIN_TOKEN,token),1800));
   return response;
  }
  // Temporary recovery: disabled unless a high-entropy Cloudflare secret is configured.
  // Remove this route and the secret immediately after the administrator recovers access.
  if(path==='/api/admin/recover-ngad'&&method==='POST'){
   const secret=env.NGAD_RECOVERY_TOKEN;
   const supplied=request.headers.get('x-recovery-token')||'';
   if(typeof secret!=='string'||secret.length<48||supplied.length<48||
      !secureCompare(await hash(supplied),await hash(secret)))return json({error:'not found'},404);
   const body=await parse(request);
   if(typeof body.newPassword!=='string'||body.newPassword.length<16||body.newPassword.length>256)
    return json({error:'new password must have 16-256 characters'},400);
   const admin=await env.DB.prepare("SELECT id,institution_id,enabled,global_admin,must_change_password FROM users WHERE username='NGAD'").first();
   if(!admin||admin.enabled!==1||admin.global_admin!==1)return json({error:'recovery unavailable'},409);
   const newHash=await passwordHash(body.newPassword);
   const changed=await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=0,failed_attempts=0,locked_until=NULL WHERE id=? AND enabled=1 AND global_admin=1")
    .bind(newHash,admin.id).run();
   if(changed.meta?.changes!==1)return json({error:'recovery unavailable'},409);
   await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(admin.id).run();
   console.info('auth.ngad.recovered');
   return json({ok:true,loginAgain:true});
  }
  if(path==='/api/login'&&method==='POST'){
   const {username,password}=await parse(request);
   if(!userName(username)||typeof password!=='string')return json({error:'invalid credentials'},401);
   const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
   if(!user||!user.enabled){
    console.warn('auth.login.denied',{reason:!user?'unknown_user':'disabled_user'});
    return json({error:'invalid credentials'},401);
   }
   // Short, automatic cooldown; no manual administrator unlock is needed.
   if(user.locked_until&&new Date(user.locked_until.replace(' ','T')+'Z')>new Date()){
    console.warn('auth.login.denied',{reason:'cooldown'});
    return json({error:'too many attempts; try again in a few minutes'},429,{'retry-after':'300'});
   }
   if(!await passwordVerify(password,user.password_hash)){
    console.warn('auth.login.denied',{reason:'password_mismatch'});
    await env.DB.prepare(`UPDATE users SET failed_attempts=CASE WHEN locked_until IS NOT NULL AND locked_until<=datetime('now') THEN 1 ELSE failed_attempts+1 END,
     locked_until=CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until<=datetime('now') THEN 1 ELSE failed_attempts+1 END)>=10 THEN datetime('now','+5 minutes') ELSE NULL END WHERE id=?`).bind(user.id).run();
    return json({error:'invalid credentials'},401);
   }
   // Keep authentication working if optional audit logging fails. A session
   // must be persisted before issuing its cookie.
   const token=random(),tokenHash=await hash(token);
   try{
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+8 hours'))").bind(tokenHash,user.id).run();
   }catch(e){
    console.error('auth.login.session_write_failed',{errorName:e?.name||'Error',errorMessage:String(e?.message||'unknown').slice(0,180)});
    return json({error:'session unavailable'},503);
   }
   try{
    await env.DB.prepare('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=?').bind(user.id).run();
   }catch(e){
    console.error('auth.login.counter_reset_failed',{errorName:e?.name||'Error'});
   }
   try{
    await env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,action) VALUES(?,?,?)').bind(user.institution_id,user.id,'login').run();
   }catch(e){
    console.error('auth.login.audit_write_failed',{errorName:e?.name||'Error',errorMessage:String(e?.message||'unknown').slice(0,180)});
   }
   console.info('auth.login.session_created',{username:'NGAD'===username?'NGAD':'other'});
   return json({ok:true,mustChangePassword:!!user.must_change_password},200,{'set-cookie':`sid=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
  }
  const actor=await current(env.DB,request,env);
  if(!actor)return json({error:'unauthorized'},401);
  if(path==='/api/logout'&&method==='POST'){
   await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(actor.token)).run();
   const response=json({ok:true});
   response.headers.append('set-cookie',cookie('sid','',0));
   response.headers.append('set-cookie',cookie('ngad_test','',0));
   return response;
  }
  if(path==='/api/me'&&method==='GET')return json({id:actor.id,username:actor.username,role:actor.role,institutionId:actor.institution_id,mustChangePassword:!!actor.must_change_password&&!actor.testAccess,centralAdmin:actor.global_admin===1&&actor.username==='NGAD',temporaryTestAccess:actor.testAccess});
  if(path==='/api/change-password'&&method==='POST'){
   const b=await parse(request);
   const saved=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(actor.id).first();
   if(!saved||!await passwordVerify(b.oldPassword,saved.password_hash))return json({error:'invalid credentials'},401);
   if(typeof b.newPassword!=='string'||b.newPassword===b.oldPassword)return json({error:'choose a different valid password'},400);
   const password_hash=await passwordHash(b.newPassword);
   // Password update and session revocation must succeed together. Audit logging
   // is best-effort and must never roll back a completed password change.
   await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=? AND password_hash=?').bind(password_hash,actor.id,saved.password_hash),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(actor.id)
   ]);
   try{
    await env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,action) VALUES(?,?,?)').bind(actor.institution_id,actor.id,'change-password').run();
   }catch(e){console.error('auth.change_password.audit_write_failed',{errorName:e?.name||'Error'});}
   const response=json({ok:true,loginAgain:true});
   response.headers.append('set-cookie',cookie('sid','',0));
   response.headers.append('set-cookie',cookie('ngad_test','',0));
   return response;
  }
  if(actor.must_change_password&&!actor.testAccess)return json({error:'change password required'},403);
  const caseMatch=path.match(/^\/api\/cases\/([a-f0-9-]{36})$/i);
  if(caseMatch&&method==='GET'){
   if(!['educator','director'].includes(actor.role))return json({error:'forbidden'},403);
   const item=await env.DB.prepare('SELECT * FROM cases WHERE id=? AND institution_id=?')
    .bind(caseMatch[1],actor.institution_id).first();
   if(!item||item.confidential===1)return json({error:'not found'},404);
   const allowed=actor.role==='educator'
    ?(!item.assigned_to||item.assigned_to===actor.id)
    :(['forwarded','answered','closed'].includes(item.status));
   if(!allowed)return json({error:'not found'},404);
   if(typeof env.CASE_ENCRYPTION_KEY!=='string'||env.CASE_ENCRYPTION_KEY.length<48)
    return json({error:'secure case access is not configured'},503);
   const encrypted=await env.DB.prepare('SELECT payload_ciphertext,payload_iv FROM case_submissions WHERE case_id=?').bind(item.id).first();
   if(!encrypted)return json({error:'case details unavailable'},404);
   const submission=await decryptSubmission(encrypted.payload_ciphertext,encrypted.payload_iv,item.id,env.CASE_ENCRYPTION_KEY);
   try{await audit(env.DB,actor,'view-case',item.id)}catch(e){console.error('audit.view_case_failed',{errorName:e?.name||'Error'});}
   return json({case:{id:item.id,caseNumber:item.case_number,category:item.category,status:item.status,createdAt:item.created_at},submission});
  }
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
  const central=actor.global_admin===1&&actor.username==='NGAD';
  if(path==='/api/users'&&method==='GET'){
   const rows=central
    ?await env.DB.prepare('SELECT id,username,display_name,role,enabled,must_change_password,institution_id AS institutionId FROM users ORDER BY created_at DESC LIMIT 100').all()
    :await env.DB.prepare('SELECT id,username,display_name,role,enabled,must_change_password,institution_id AS institutionId FROM users WHERE institution_id=? ORDER BY created_at DESC LIMIT 100').bind(actor.institution_id).all();
   return json({users:rows.results});
  }
  if(path==='/api/analytics'&&method==='GET'){
   const counts=central?await env.DB.prepare('SELECT institution_id AS institutionId,action,count(*) AS count FROM audit_events GROUP BY institution_id,action ORDER BY institution_id,action').all():await env.DB.prepare('SELECT institution_id AS institutionId,action,count(*) AS count FROM audit_events WHERE institution_id=? GROUP BY institution_id,action').bind(actor.institution_id).all();
   const recent=central?await env.DB.prepare('SELECT institution_id AS institutionId,actor_id AS actorId,action,created_at AS at FROM audit_events ORDER BY id DESC LIMIT 50').all():await env.DB.prepare('SELECT institution_id AS institutionId,actor_id AS actorId,action,created_at AS at FROM audit_events WHERE institution_id=? ORDER BY id DESC LIMIT 50').bind(actor.institution_id).all();
   return json({total:counts.results.reduce((a,x)=>a+x.count,0),byAction:counts.results,recent:recent.results});
  }
  if(path==='/api/users'&&method==='POST'){
   const b=await parse(request);
   if(!userName(b.username)||!roles.has(b.role)||typeof b.displayName!=='string'||!b.displayName.trim()||b.username.toUpperCase()==='NGAD')return json({error:'invalid user'},400);
   const institutionId=central?b.institutionId:actor.institution_id;
   if(!['IDR','PRI','STI'].includes(institutionId)||!central&&b.institutionId&&b.institutionId!==actor.institution_id)return json({error:'invalid institution'},403);
   const password_hash=await passwordHash(b.password),id=crypto.randomUUID();
   await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,institution_id,username,role,display_name,password_hash) VALUES(?,?,?,?,?,?)').bind(id,institutionId,b.username,b.role,b.displayName,password_hash),
    env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(institutionId,actor.id,id,'create-user')
   ]);
   return json({id,username:b.username,role:b.role},201);
  }
  const match=path.match(/^\/api\/users\/([a-f0-9-]{36})\/(disable|delete|reset-password)$/);
  if(match&&method==='POST'){
   const [,id,action]=match;
   if(id===actor.id)return json({error:'cannot modify self'},403);
   const target=central?await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first():await env.DB.prepare('SELECT * FROM users WHERE id=? AND institution_id=?').bind(id,actor.institution_id).first();
   // Never allow delegated admins to modify NGAD, even on databases where
   // the optional global_admin column has not yet been migrated.
   if(!target||target.global_admin===1||target.username?.toUpperCase()==='NGAD')return json({error:'forbidden'},403);
   const statements=[];
   if(action==='reset-password'){
    const b=await parse(request);statements.push(env.DB.prepare('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=? AND institution_id=?').bind(await passwordHash(b.password),id,target.institution_id));
   }else statements.push(env.DB.prepare('UPDATE users SET enabled=0 WHERE id=? AND institution_id=?').bind(id,target.institution_id));
   statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
   statements.push(env.DB.prepare('INSERT INTO audit_events(institution_id,actor_id,target_id,action) VALUES(?,?,?,?)').bind(target.institution_id,actor.id,id,action));
   await env.DB.batch(statements);return json({ok:true});
  }
  return json({error:'not found'},404);
 }catch(e){console.error('api.unhandled_error',{path,errorName:e?.name||'Error',errorMessage:String(e?.message||'unknown').slice(0,160)});return json({error:'request failed',stage:path},500)}
}};
