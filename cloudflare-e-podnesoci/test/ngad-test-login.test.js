import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const secret='ngad-test-token-'+'a'.repeat(64);
const url='https://zdnp.org';
const validUntil=()=>new Date(Date.now()+60*60*1000).toISOString();
const request=(path,body,extra={})=>new Request(url+path,{
 method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(body)
});

function fakeDb({username='NGAD',role='institution_admin',global_admin=1,enabled=1}={}){
 const user={id:'ngad-id',institution_id:'IDR',username,role,global_admin,enabled,must_change_password:1};
 const sessions=new Map();
 const audit=[];
 const prepare=sql=>({
  bind(...params){return statement(sql,params)},
  ...statement(sql,[])
 });
 function statement(sql,params){
  return {
   sql,params,
   async first(){
    if(sql.startsWith("SELECT * FROM users WHERE username='NGAD'"))
     return username==='NGAD'&&role==='institution_admin'&&global_admin===1&&enabled===1?user:null;
    if(sql.startsWith('SELECT u.*')){
     const session=sessions.get(params[0]);
     return session?.expiry>Date.now()&&enabled===1?user:null;
    }
    throw Error('unexpected first: '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT INTO sessions')){
     if(sessions.has(params[0]))throw Error('UNIQUE constraint failed');
     sessions.set(params[0],{userId:params[1],expiry:Date.now()+(sql.includes("'-1 second'")?-1000:30*60000)});
     return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO audit_events')){audit.push(params);return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM sessions')){
     sessions.delete(params[0]);return {meta:{changes:1}};
    }
    throw Error('unexpected run: '+sql);
   },
   async all(){
    if(sql.startsWith('SELECT id,username'))return {results:[user]};
    throw Error('unexpected all: '+sql);
   }
  };
 }
 return {
  sessions,audit,
  prepare,
  async batch(statements){
   const before=new Map(sessions);
   try{return await Promise.all(statements.map(item=>item.run()));}
   catch(error){sessions.clear();for(const [key,value] of before)sessions.set(key,value);throw error;}
  }
 };
}

test('NGAD test login is disabled without a secret and expiry',async()=>{
 const db=fakeDb();
 const result=await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),{DB:db});
 assert.equal(result.status,404);
 assert.equal(db.sessions.size,0);
});

test('NGAD token rejects wrong value, expired window, and non-NGAD accounts',async()=>{
 const db=fakeDb();
 const env={DB:db,NGAD_TEST_LOGIN_TOKEN:secret,NGAD_TEST_LOGIN_UNTIL:validUntil()};
 assert.equal((await worker.fetch(request('/api/admin/test-login-ngad',{token:secret+'x'}),env)).status,404);
 assert.equal((await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),{...env,NGAD_TEST_LOGIN_UNTIL:new Date(Date.now()-1000).toISOString()})).status,404);
 assert.equal((await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),{...env,DB:fakeDb({username:'other'})})).status,409);
 assert.equal((await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),{...env,DB:fakeDb({global_admin:0})})).status,409);
 assert.equal(db.sessions.size,0);
});

test('one-use NGAD token creates 30-minute authenticated admin session without changing password',async()=>{
 const db=fakeDb();
 const env={DB:db,NGAD_TEST_LOGIN_TOKEN:secret,NGAD_TEST_LOGIN_UNTIL:validUntil()};
 const login=await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),env);
 assert.equal(login.status,200);
 assert.equal((await login.json()).username,'NGAD');
 const cookies=login.headers.getSetCookie();
 assert.equal(cookies.length,2);
 assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')&&c.includes('Max-Age=1800')));
 const rawCookies=cookies.map(value=>value.split(';')[0]).join('; ');
 const me=await worker.fetch(new Request(url+'/api/me',{headers:{cookie:rawCookies}}),env);
 assert.equal(me.status,200);
 assert.deepEqual((({username,temporaryTestAccess,mustChangePassword,centralAdmin})=>({username,temporaryTestAccess,mustChangePassword,centralAdmin}))(await me.json()),{
  username:'NGAD',temporaryTestAccess:true,mustChangePassword:false,centralAdmin:true
 });
 const users=await worker.fetch(new Request(url+'/api/users',{headers:{cookie:rawCookies}}),env);
 assert.equal(users.status,200);
 assert.equal((await worker.fetch(request('/api/admin/test-login-ngad',{token:secret}),env)).status,409);
 const tampered=rawCookies.replace(/ngad_test=[a-f0-9]{64}/,'ngad_test='+'b'.repeat(64));
 assert.equal((await (await worker.fetch(new Request(url+'/api/me',{headers:{cookie:tampered}}),env)).json()).mustChangePassword,true);
 assert.equal((await (await worker.fetch(new Request(url+'/api/me',{headers:{cookie:rawCookies}}),{
  ...env,NGAD_TEST_LOGIN_UNTIL:new Date(Date.now()-1000).toISOString()
 })).json()).mustChangePassword,true);
 const logout=await worker.fetch(request('/api/logout',{}, {cookie:rawCookies}),env);
 assert.equal(logout.status,200);
 assert.equal(logout.headers.getSetCookie().length,2);
 assert.equal((await worker.fetch(new Request(url+'/api/me',{headers:{cookie:rawCookies}}),env)).status,401);
 assert.equal(db.sessions.size,1); // Only the expired one-time-use marker remains.
 assert.equal(db.audit.length,1);
});
