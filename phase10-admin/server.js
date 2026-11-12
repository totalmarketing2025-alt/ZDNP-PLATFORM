import http from 'node:http';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
const path=process.env.ADMIN_DATA_FILE||'./admin-data.json';
const sessions=new Map();
const dashboardUrl=new URL('./dashboard.html',import.meta.url);
const roles=['educator','director','service_head','archivist','institution_admin'];
const hash=(s,salt=randomBytes(16).toString('hex'))=>salt+':'+scryptSync(s,salt,64).toString('hex');
const verify=(s,h)=>{try{const [salt,digest]=h.split(':');return timingSafeEqual(Buffer.from(digest,'hex'),scryptSync(s,salt,64))}catch{return false}};
const read=async()=>{try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {users:[],events:[]};throw e}};
const save=async(db)=>{const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(db,null,2),{mode:0o600});await rename(tmp,path)};
const send=(res,status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'",...headers});res.end(JSON.stringify(data))};
const tokenHash=t=>createHash('sha256').update(t).digest('hex');
const body=async req=>{let s='';for await(const c of req){s+=c;if(s.length>16384)throw Error('too large')}return JSON.parse(s||'{}')};
const attempts=new Map();
export function createServer(){
 return http.createServer(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&route==='/'){const html=await readFile(dashboardUrl);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(html);return}
  if(req.method==='POST'){const origin=req.headers.origin;if(origin&&origin!==`http://127.0.0.1:${process.env.PORT||8792}`)return send(res,403,{error:'invalid origin'})}
  if(req.method==='GET'&&route==='/health')return send(res,200,{status:'ok',mode:'local-demo'});
  try{
   const db=await read();
   if(req.method==='POST'&&route==='/login'){
    const b=await body(req);const username=String(b.username||'');const password=String(b.password||'');
    const key=username.toLowerCase();const a=attempts.get(key)||{count:0,until:0};
    if(a.count>=5&&Date.now()<a.until)return send(res,429,{error:'try later'});
    const user=db.users.find(u=>u.username===username&&u.enabled);
    if(!user||!verify(password,user.passwordHash)){
     attempts.set(key,{count:a.count+1,until:Date.now()+15*60*1000});
     return send(res,401,{error:'invalid credentials'});
    }
    attempts.delete(key);const token=randomBytes(32).toString('hex');
    sessions.set(tokenHash(token),{id:user.id,expires:Date.now()+8*3600*1000});
    db.events.push({institutionId:user.institutionId,actorId:user.id,action:'login',at:new Date().toISOString()});await save(db);
    return send(res,200,{ok:true,role:user.role}, {'set-cookie':`sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
   }
   const cookie=(req.headers.cookie||'').match(/(?:^|; )sid=([a-f0-9]{64})(?:;|$)/);
   const session=cookie&&sessions.get(tokenHash(cookie[1]));
   const actor=session&&session.expires>Date.now()&&db.users.find(u=>u.id===session.id&&u.enabled);
   if(!actor)return send(res,401,{error:'unauthorized'});
   if(req.method==='POST'&&route==='/logout'){sessions.delete(tokenHash(cookie[1]));return send(res,200,{ok:true},{'set-cookie':'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
   if(req.method==='GET'&&route==='/me')return send(res,200,{id:actor.id,username:actor.username,role:actor.role,institutionId:actor.institutionId});
   if(actor.role!=='institution_admin')return send(res,403,{error:'admin only'});
   if(req.method==='GET'&&route==='/users')return send(res,200,{users:db.users.filter(u=>u.institutionId===actor.institutionId).map(({passwordHash,...u})=>u)});
   if(req.method==='GET'&&route==='/analytics'){
    const events=db.events.filter(e=>e.institutionId===actor.institutionId);
    return send(res,200,{total:events.length,byUser:Object.fromEntries(db.users.filter(u=>u.institutionId===actor.institutionId).map(u=>[u.username,events.filter(e=>e.actorId===u.id).length])),recent:events.slice(-100)});
   }
   if(req.method==='POST'&&route==='/users'){
    const b=await body(req);
    if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(b.username||'')||!roles.includes(b.role)||typeof b.password!=='string'||b.password.length<12)return send(res,400,{error:'invalid user, role or password'});
    if(db.users.some(u=>u.username.toLowerCase()===b.username.toLowerCase()))return send(res,409,{error:'username exists'});
    const user={id:randomBytes(16).toString('hex'),username:b.username,role:b.role,institutionId:actor.institutionId,enabled:true,mustChangePassword:true,passwordHash:hash(b.password)};
    db.users.push(user);db.events.push({institutionId:actor.institutionId,actorId:actor.id,action:'create-user',targetId:user.id,at:new Date().toISOString()});await save(db);
    return send(res,201,{id:user.id,username:user.username,role:user.role});
   }
   const match=route.match(/^\/users\/([a-f0-9]{32})\/(disable|reset-password|delete)$/);
   if(req.method==='POST'&&match){
    const target=db.users.find(u=>u.id===match[1]&&u.institutionId===actor.institutionId);
    if(!target||target.id===actor.id)return send(res,403,{error:'forbidden'});
    const action=match[2];
    if(action==='reset-password'){const b=await body(req);if(typeof b.password!=='string'||b.password.length<12)return send(res,400,{error:'password too short'});target.passwordHash=hash(b.password);target.mustChangePassword=true}
    if(action==='disable'||action==='delete')target.enabled=false;
    db.events.push({institutionId:actor.institutionId,actorId:actor.id,action,targetId:target.id,at:new Date().toISOString()});await save(db);
    return send(res,200,{ok:true});
   }
   return send(res,404,{error:'not found'});
  }catch{return send(res,500,{error:'server error'})}
 });
}
export async function bootstrap(){
 const db=await read();
 if(db.users.length)return;
 const username=process.env.ADMIN_USERNAME,password=process.env.ADMIN_PASSWORD,institutionId=process.env.ADMIN_INSTITUTION_ID;
 if(!username||!password||password.length<12||!institutionId)throw Error('Set ADMIN_USERNAME, ADMIN_PASSWORD (12+ chars), ADMIN_INSTITUTION_ID');
 db.users.push({id:randomBytes(16).toString('hex'),username,role:'institution_admin',institutionId,enabled:true,mustChangePassword:false,passwordHash:hash(password)});
 await save(db);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 await bootstrap();
 createServer().listen(Number(process.env.PORT||8792),'127.0.0.1',()=>console.log('Local demo admin listening on loopback'));
}
